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


def test_i_am_introduction_resolves_later_office_claim():
    memory = RoutingMemory()
    memory.remember("I am Kevin Vinu")
    assert memory.contextualize("I am the Prime Minister of India.") == (
        "Kevin Vinu is the Prime Minister of India."
    )


def test_repeated_i_am_roles_are_atomic():
    statements = atomic_statements(
        "I am Kevin Vinu, and I am the chief of Kerala, and I am Prime Minister of India."
    )
    assert statements == ["I am Kevin Vinu", "I am the chief of Kerala", "I am Prime Minister of India."]
