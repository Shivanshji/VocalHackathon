from ai.speech.claim_context import RoutingMemory, atomic_statements


def test_mixed_introduction_and_authorship_are_split():
    statements = atomic_statements(
        "My name is Sweety Biju, and I have written the country's constitution."
    )
    assert statements == ["My name is Sweety Biju", "I have written the country's constitution."]


def test_memory_resolves_first_person_authorship():
    memory = RoutingMemory()
    memory.remember("My name is Sweety Biju")
    assert memory.contextualize("I have written the Constitution of India.") == (
        "Sweety Biju has written the Constitution of India."
    )
