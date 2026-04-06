"""Эндпоинты Bitrix24: установка приложения, вход (OAuth → user id), события чат-бота."""

from __future__ import annotations

import html
import json
import logging
from typing import Any, Optional
from urllib.parse import parse_qs, quote

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

import bitrix_crud
import crud
import schemas
from bitrix_service import (
    bitrix_handoff_sign_user_id,
    bitrix_handoff_verify,
    bitrix_imbot_message_add,
    bitrix_oauth_build_authorize_url,
    bitrix_oauth_exchange_code,
    bitrix_oauth_sign_state,
    bitrix_oauth_verify_state,
    normalize_bitrix_domain,
    parse_install_auth_param,
    portal_install_auth_from_oauth_token_payload,
)
from config import settings
from database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bitrix", tags=["bitrix"])


@router.api_route("/install", methods=["GET", "POST"], response_model=None)
async def bitrix_install(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """
    Первоначальная установка локального приложения: сохраняет токены портала и завершает установку в UI.
    В карточке приложения Bitrix24 укажите этот URL как «Путь для первоначальной установки».

    Без параметра auth установка не завершится. Раньше делался редирект 302 на Vercel — для POST
    от Bitrix браузер терял тело запроса, установка ломалась; теперь показываем страницу с подсказкой.
    """
    auth_raw = await _read_install_auth_param(request)
    if not auth_raw:
        logger.warning("bitrix/install: параметр auth не найден (method=%s)", request.method)
        return _html_response(_install_missing_auth_html())

    try:
        auth = parse_install_auth_param(auth_raw)
    except ValueError as exc:
        return _html_response(_install_parse_error_html(str(exc)))
    if auth is None:
        return _html_response(_install_parse_error_html("Пустой auth"))

    try:
        await bitrix_crud.upsert_bitrix_portal(db, auth)
    except ValueError as exc:
        return _html_response(_install_parse_error_html(str(exc)))

    return _html_response(_install_finish_html())


@router.post("/session", response_model=schemas.BitrixSessionResponse)
async def bitrix_session(
    body: schemas.BitrixSessionRequest,
    db: AsyncSession = Depends(get_db),
) -> schemas.BitrixSessionResponse:
    """
    Обменивает пользовательский OAuth Bitrix24 (из BX24.getAuth) на пользователя HR.
    Вызывается с фронтенда (страница bitrix.html) после BX24.init.
    """
    try:
        user = await bitrix_crud.get_or_create_user_for_bitrix(
            db,
            body.domain,
            body.access_token,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if user.status == "blocked":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Аккаунт заблокирован")
    if user.status == "rejected":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Заявка отклонена")

    return schemas.BitrixSessionResponse(
        user_id=user.id,
        user=schemas.UserResponse.model_validate(user),
    )


@router.get("/oauth/status")
def bitrix_oauth_status() -> dict[str, bool]:
    """Показывает, включён ли обход входа через полный OAuth (когда BX24.init в iframe не работает)."""
    enabled = bool(
        settings.BITRIX_CLIENT_ID.strip()
        and settings.BITRIX_CLIENT_SECRET.strip()
        and settings.BITRIX_OAUTH_REDIRECT_URI.strip()
    )
    return {"oauth_enabled": enabled}


@router.get("/oauth/start", response_model=None)
async def bitrix_oauth_start(domain: str) -> Response:
    """
    Редирект на страницу авторизации портала Bitrix24 (шаг 1 OAuth 2.0).
    В карточке локального приложения укажите тот же redirect_uri, что BITRIX_OAUTH_REDIRECT_URI.
    """
    if not settings.BITRIX_CLIENT_ID.strip() or not settings.BITRIX_CLIENT_SECRET.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OAuth Bitrix24 не настроен: задайте BITRIX_CLIENT_ID и BITRIX_CLIENT_SECRET в API.",
        )
    if not settings.BITRIX_OAUTH_REDIRECT_URI.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Не задан BITRIX_OAUTH_REDIRECT_URI.",
        )
    try:
        state = bitrix_oauth_sign_state(domain)
        url = bitrix_oauth_build_authorize_url(
            domain,
            state,
            settings.BITRIX_OAUTH_REDIRECT_URI.strip(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return RedirectResponse(url=url, status_code=302)


@router.get("/oauth/callback", response_model=None)
async def bitrix_oauth_callback(
    db: AsyncSession = Depends(get_db),
    code: Optional[str] = None,
    state: Optional[str] = None,
    domain: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
) -> Response:
    """Шаг 2 OAuth: обмен code на токен, создание пользователя HR, редирект на Vercel с handoff-токеном."""
    if error:
        return _html_response(_oauth_error_html(error, error_description))
    if not code or not state:
        return _html_response(
            _oauth_error_html("missing_params", "Нет code или state в ответе Bitrix24.")
        )
    try:
        expected_dom = bitrix_oauth_verify_state(state)
    except ValueError as exc:
        return _html_response(_oauth_error_html("invalid_state", str(exc)))

    if domain:
        dom = normalize_bitrix_domain(domain)
        if dom != expected_dom:
            return _html_response(
                _oauth_error_html(
                    "domain_mismatch",
                    "Домен в ответе Bitrix не совпадает с начатым входом. Закройте окно и начните вход снова.",
                )
            )
    else:
        dom = expected_dom

    try:
        token_payload = await bitrix_oauth_exchange_code(
            code,
            settings.BITRIX_OAUTH_REDIRECT_URI.strip(),
        )
    except ValueError as exc:
        return _html_response(_oauth_error_html("token_exchange", str(exc)))
    except Exception as exc:
        logger.exception("OAuth token exchange failed")
        return _html_response(_oauth_error_html("token_exchange", str(exc)))

    access_token = token_payload.get("access_token")
    if not access_token or not isinstance(access_token, str):
        return _html_response(_oauth_error_html("no_access_token", "В ответе oauth/token нет access_token."))

    portal_auth = portal_install_auth_from_oauth_token_payload(dom, token_payload)
    if portal_auth:
        try:
            await bitrix_crud.upsert_bitrix_portal(db, portal_auth)
        except ValueError as exc:
            logger.warning("OAuth: не сохранён портал (ожидаемо при неверных полях): %s", exc)
        except Exception:
            logger.exception("OAuth: ошибка сохранения портала по токену")

    try:
        user = await bitrix_crud.get_or_create_user_for_bitrix(db, dom, access_token)
    except ValueError as exc:
        return _html_response(_oauth_error_html("user", str(exc)))

    if user.status == "blocked":
        return _html_response(_oauth_error_html("blocked", "Аккаунт заблокирован."))
    if user.status == "rejected":
        return _html_response(_oauth_error_html("rejected", "Заявка отклонена."))

    handoff = bitrix_handoff_sign_user_id(user.id)
    base = settings.BITRIX_WEB_APP_URL.rstrip("/")
    target = f"{base}/bitrix-oauth-handoff.html?t={quote(handoff, safe='')}"
    return RedirectResponse(url=target, status_code=302)


@router.post("/oauth/handoff", response_model=schemas.BitrixSessionResponse)
async def bitrix_oauth_handoff(
    body: schemas.BitrixOAuthHandoffRequest,
    db: AsyncSession = Depends(get_db),
) -> schemas.BitrixSessionResponse:
    """Меняет одноразовый токен после OAuth на ту же сессию, что и POST /bitrix/session."""
    try:
        uid = bitrix_handoff_verify(body.token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    user = await crud.get_user(db, uid)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    if user.status == "blocked":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Аккаунт заблокирован")
    if user.status == "rejected":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Заявка отклонена")

    return schemas.BitrixSessionResponse(
        user_id=user.id,
        user=schemas.UserResponse.model_validate(user),
    )


@router.post("/event")
async def bitrix_event(request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    """
    Обработчик событий Bitrix24 (в т.ч. ONIMBOTMESSAGEADD для чат-бота).
    Укажите URL: .../bitrix/event в настройках исходящих вебхуков или при регистрации бота.
    """
    payload = await _parse_event_payload(request)
    event_name = str(payload.get("event") or payload.get("EVENT") or "").strip()
    auth = _parse_auth_from_event_payload(payload)
    await _verify_event_application_token(db, auth)

    raw_data = payload.get("data")
    data_obj: dict[str, Any] = {}
    if isinstance(raw_data, str):
        try:
            data_obj = json.loads(raw_data)
        except json.JSONDecodeError:
            data_obj = {}
    elif isinstance(raw_data, dict):
        data_obj = raw_data

    if event_name == "ONIMBOTMESSAGEADD":
        await _handle_imbot_message_add(db, data_obj, auth)
    else:
        logger.info("Bitrix event (не обработан): %s", event_name)

    return {"status": "ok"}


def _flat_params_to_auth_json(flat: dict[str, str]) -> Optional[str]:
    """Собирает JSON auth из плоских полей POST (вариант без обёртки auth у Bitrix24)."""
    token = flat.get("access_token") or flat.get("AUTH_ID")
    member = flat.get("member_id") or flat.get("memberId")
    domain = flat.get("domain") or flat.get("DOMAIN")
    if not token or not member or not domain:
        return None
    obj: dict[str, Any] = {
        "access_token": str(token),
        "member_id": str(member),
        "domain": str(domain),
    }
    if flat.get("refresh_token"):
        obj["refresh_token"] = str(flat["refresh_token"])
    if flat.get("application_token"):
        obj["application_token"] = str(flat["application_token"])
    if flat.get("client_endpoint"):
        obj["client_endpoint"] = str(flat["client_endpoint"])
    exp = flat.get("expires") or flat.get("expires_in")
    if exp:
        obj["expires"] = exp
    return json.dumps(obj)


async def _read_install_auth_param(request: Request) -> Optional[str]:
    """Читает auth из query, JSON-тела, urlencoded, multipart или плоских полей POST."""
    for key in ("auth", "AUTH"):
        q = request.query_params.get(key)
        if q:
            return q
    if request.method != "POST":
        return None

    ctype = (request.headers.get("content-type") or "").lower()

    if "multipart/form-data" in ctype:
        try:
            form = await request.form()
            flat = {str(k): str(form[k]) for k in form}
            if flat.get("auth"):
                return flat["auth"]
            if flat.get("AUTH"):
                return flat["AUTH"]
            alt = _flat_params_to_auth_json(flat)
            if alt:
                return alt
        except Exception as exc:
            logger.warning("bitrix install: multipart: %s", exc)
        return None

    body = await request.body()
    if not body:
        return None
    text = body.decode("utf-8", errors="replace")
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            for key in ("auth", "AUTH"):
                if data.get(key) is not None:
                    return str(data[key])
    except json.JSONDecodeError:
        pass
    try:
        parsed = parse_qs(text)
        flat = {k: v[0] for k, v in parsed.items() if v}
        if flat.get("auth"):
            return str(flat["auth"])
        if flat.get("AUTH"):
            return str(flat["AUTH"])
        alt = _flat_params_to_auth_json(flat)
        if alt:
            return alt
    except Exception as exc:
        logger.warning("bitrix install: parse_qs: %s", exc)
    return None


def _html_response(body: str) -> HTMLResponse:
    """Ответ HTML для страниц установки Bitrix (в т.ч. в iframe)."""
    return HTMLResponse(content=body, media_type="text/html; charset=utf-8")


def _oauth_error_html(code: str, detail: Optional[str] = None) -> str:
    """HTML при ошибке OAuth (показывается после редиректа с oauth.bitrix.info)."""
    safe_code = html.escape(str(code), quote=True)
    safe_detail = html.escape(str(detail or ""), quote=True)
    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <title>Ошибка входа Bitrix24 (OAuth)</title>
</head>
<body>
  <h1>Не удалось завершить вход</h1>
  <p><strong>{safe_code}</strong></p>
  <p>{safe_detail}</p>
  <p>Закройте вкладку и откройте приложение в портале снова.</p>
</body>
</html>
"""


def _install_missing_auth_html() -> str:
    """HTML, если Bitrix не передал auth (или формат тела не распознан)."""
    base = html.escape(settings.BITRIX_WEB_APP_URL.rstrip("/"), quote=True)
    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <title>Установка Bitrix24 — нет auth</title>
</head>
<body>
  <h1>Не удалось прочитать данные установки (auth)</h1>
  <p>При первом открытии приложения Bitrix24 должен передать токены в запросе к
  <strong>Пути для первоначальной установки</strong> (поле <code>auth</code> или набор полей
  <code>access_token</code>, <code>member_id</code>, <code>domain</code>).</p>
  <p><strong>Не открывайте</strong> этот URL вручную в новой вкладке — зайдите в портал:
  <strong>Приложения</strong> → ваше приложение → <strong>Переустановить</strong> или откройте из меню.</p>
  <p>Если использовали POST: редирект 302 на другой домен <strong>сбрасывает тело запроса</strong>;
  на API должны приходить именно поля установки (см.
  <a href="https://apidocs.bitrix24.com/settings/app-installation/installation-finish.html">документацию</a>).</p>
  <p><a href="{base}/bitrix.html">Открыть обработчик (bitrix.html на Vercel)</a></p>
</body>
</html>
"""


def _install_parse_error_html(detail: str) -> str:
    """HTML при ошибке разбора auth или сохранения портала."""
    safe = html.escape(detail, quote=True)
    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <title>Ошибка установки Bitrix24</title>
</head>
<body>
  <h1>Ошибка установки</h1>
  <p>{safe}</p>
</body>
</html>
"""


def _install_finish_html() -> str:
    """HTML с вызовом BX24.installFinish() после успешного сохранения токенов.

    По документации Bitrix24, пока не вызван BX24.installFinish(), портал считает
    приложение ненастроенным и при открытии снова показывает слайдер с URL установки.
    Порядок как в официальном примере: DOM → BX24.init → installFinish; SDK грузим
    с onload (иначе inline мог выполниться до появления BX24).
    """
    return _INSTALL_FINISH_HTML


_INSTALL_FINISH_HTML = """<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <title>Установка HR Спасибо</title>
</head>
<body>
  <p id="status">Завершение установки…</p>
  <script>
(function () {
  function setStatus(text) {
    var el = document.getElementById("status");
    if (el) { el.textContent = text; }
  }
  function fail(msg) {
    setStatus(msg || "Ошибка завершения установки");
    if (typeof console !== "undefined" && console.error) { console.error(msg); }
  }
  function whenDomReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }
  function runInstallFinish() {
    var deadline = window.setTimeout(function () {
      fail("BX24.init не ответил. Обновите страницу или откройте приложение из меню портала.");
    }, 45000);
    function callInit() {
      BX24.init(function () {
        window.clearTimeout(deadline);
        BX24.installFinish();
      });
    }
    var scheduled = false;
    function scheduleOnce() {
      if (scheduled) { return; }
      scheduled = true;
      window.setTimeout(callInit, 0);
    }
    var rf = 5000;
    if (typeof BX24.ready === "function") {
      var rt = window.setTimeout(function () {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[HR Bitrix install] BX24.ready таймаут " + rf + " мс — вызываем init");
        }
        scheduleOnce();
      }, rf);
      BX24.ready(function () {
        window.clearTimeout(rt);
        scheduleOnce();
      });
    } else {
      scheduleOnce();
    }
  }
  function afterSdkLoaded() {
    whenDomReady(function () {
      var tries = 0;
      function waitBx() {
        if (typeof BX24 !== "undefined") {
          runInstallFinish();
          return;
        }
        tries += 1;
        if (tries > 80) {
          fail("SDK Bitrix24 не загружен.");
          return;
        }
        window.setTimeout(waitBx, 50);
      }
      waitBx();
    });
  }
  window.__hrBitrixInstallFinishOnSdkLoad = function () {
    afterSdkLoaded();
  };
  window.__hrBitrixInstallFinishOnSdkError = function () {
    fail("Не удалось загрузить скрипт Bitrix24.");
  };
})();
  </script>
  <script src="//api.bitrix24.com/api/v1/" onload="window.__hrBitrixInstallFinishOnSdkLoad()" onerror="window.__hrBitrixInstallFinishOnSdkError()"></script>
</body>
</html>
"""


async def _parse_event_payload(request: Request) -> dict[str, Any]:
    """Разбирает тело вебхука Bitrix (JSON или x-www-form-urlencoded)."""
    ctype = request.headers.get("content-type", "")
    if "application/json" in ctype:
        body = await request.json()
        return body if isinstance(body, dict) else {}
    form = await request.form()
    return {str(k): v for k, v in form.items()}


def _parse_auth_from_event_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Извлекает блок auth из события Bitrix24."""
    auth = payload.get("auth")
    if isinstance(auth, str):
        try:
            parsed = json.loads(auth)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    if isinstance(auth, dict):
        return auth
    return {}


async def _verify_event_application_token(db: AsyncSession, auth: dict[str, Any]) -> None:
    """Проверяет application_token для исходящих событий (если токен сохранён при установке)."""
    domain = auth.get("domain")
    token = auth.get("application_token")
    if not domain or not token:
        return
    portal = await bitrix_crud.get_bitrix_portal_by_domain(db, str(domain))
    if portal is None or not portal.application_token:
        return
    if str(portal.application_token) != str(token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Неверный application_token события",
        )


async def _handle_imbot_message_add(
    db: AsyncSession,
    data: dict[str, Any],
    auth: dict[str, Any],
) -> None:
    """Отвечает на сообщение чат-боту простыми командами (баланс, помощь)."""
    text, bot_id, dialog_id, from_user_id = _extract_imbot_fields(data)
    access_token = auth.get("access_token")
    domain = auth.get("domain")
    if not text or bot_id is None or not dialog_id or not access_token or not domain:
        logger.warning("ONIMBOTMESSAGEADD: неполные данные для ответа")
        return

    reply = await _compose_bot_reply(db, str(domain), from_user_id, text)
    try:
        await bitrix_imbot_message_add(
            normalize_bitrix_domain(str(domain)),
            str(access_token),
            bot_id,
            dialog_id,
            reply,
        )
    except Exception as exc:
        logger.exception("Не удалось отправить ответ бота: %s", exc)


def _extract_imbot_fields(
    data: dict[str, Any],
) -> tuple[str, Optional[int], Optional[str], Optional[int]]:
    """Достаёт текст, BOT_ID, DIALOG_ID и FROM_USER_ID из payload события."""
    params = data.get("PARAMS") if isinstance(data.get("PARAMS"), dict) else data

    msg = data.get("MESSAGE")
    if msg is None and isinstance(params, dict):
        msg = params.get("MESSAGE")

    text: str = ""
    if isinstance(msg, dict):
        raw = msg.get("TEXT") or msg.get("text") or ""
        text = str(raw).strip()
    elif isinstance(msg, str):
        text = msg.strip()

    bot_raw = data.get("BOT_ID")
    if bot_raw is None and isinstance(params, dict):
        bot_raw = params.get("BOT_ID")
    bot_id: Optional[int] = None
    if bot_raw is not None:
        try:
            bot_id = int(bot_raw)
        except (TypeError, ValueError):
            bot_id = None

    dialog_raw = data.get("DIALOG_ID")
    if dialog_raw is None and isinstance(params, dict):
        dialog_raw = params.get("DIALOG_ID")
    dialog_id = str(dialog_raw).strip() if dialog_raw else None

    from_raw = None
    if isinstance(params, dict):
        from_raw = params.get("FROM_USER_ID") or params.get("MESSAGE_FROM_USER_ID")
    if from_raw is None:
        from_raw = data.get("FROM_USER_ID")

    from_uid: Optional[int] = None
    if from_raw is not None:
        try:
            from_uid = int(from_raw)
        except (TypeError, ValueError):
            from_uid = None

    return text, bot_id, dialog_id, from_uid


async def _compose_bot_reply(
    db: AsyncSession,
    domain: str,
    bitrix_user_id: Optional[int],
    text: str,
) -> str:
    """Формирует текст ответа бота в мессенджере."""
    t = (text or "").strip().lower()
    if bitrix_user_id is None:
        return (
            "Откройте приложение «HR Спасибо» из меню портала Bitrix24 и выполните вход."
        )

    user = await bitrix_crud.find_user_by_bitrix(db, bitrix_user_id, domain)
    if not user:
        return (
            "Профиль в HR Спасибо не найден. Один раз откройте приложение из меню портала и войдите."
        )

    if t in ("баланс", "balance", "/balance"):
        return f"Ваш баланс спасибок: {user.balance}."
    if t in ("help", "помощь", "/help", "start", "/start"):
        return "Команды: «баланс», «помощь». Полный функционал — в приложении в меню портала."
    return "Напишите «баланс» или «помощь». Полный функционал — в приложении в меню портала."
