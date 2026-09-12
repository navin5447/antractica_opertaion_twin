from typing import Literal

from pydantic import BaseModel


class DecisionEntry(BaseModel):
    id: int
    station: Literal["Maitri", "Bharati"]
    timestamp: str
    connectivity_state: str
    trigger: str
    rule: str
    action: str
    safety_limit: str
    outcome: str
    status: str
