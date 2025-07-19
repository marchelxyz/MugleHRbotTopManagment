```python
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from backend import crud
from backend.database import get_db, settings

router = APIRouter()

@router.post("/admin/reset-balances")
async def reset_balances(x_api_key: str = Header(...), db: AsyncSession = Depends(get_db)):
    if x_api_key != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid API Key")
    await crud.reset_balances(db)
    return {"detail": "Balances reset"}
```
