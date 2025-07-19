```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from backend import crud, schemas
from backend.database import get_db

router = APIRouter()

@router.get("/market/items", response_model=list[schemas.MarketItemResponse])
async def list_items(db: AsyncSession = Depends(get_db)):
    return await crud.get_market_items(db)

@router.post("/market/purchase", response_model=schemas.MarketItemResponse)
async def purchase_item(request: schemas.PurchaseRequest, db: AsyncSession = Depends(get_db)):
    item = await crud.get_market_items(db)  # get item stock etc
    return await crud.create_purchase(db, request)
```
