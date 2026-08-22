import pytest
from pydantic import ValidationError
from backend.models import FactCheckGateResult, StatementType

def test_gate_schema():
    result = FactCheckGateResult(should_fact_check=True, statement_type="factual_claim", reason="Specific measurable claim.")
    assert result.statement_type is StatementType.factual_claim

def test_gate_rejects_unknown_model_type():
    with pytest.raises(ValidationError):
        FactCheckGateResult(should_fact_check=False, statement_type="invented", reason="Invalid")
