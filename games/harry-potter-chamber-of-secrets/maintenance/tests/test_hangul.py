from src.hangul import decompose_syllable, decompose_text


def test_decompose_complete_syllable_with_final():
    assert decompose_syllable("한") == (18, 0, 4)


def test_decompose_syllable_without_final_and_skip_ascii():
    assert decompose_syllable("가") == (0, 0, 0)
    assert decompose_syllable("A") is None
    assert decompose_text("A한글!") == [("한", (18, 0, 4)), ("글", (0, 18, 8))]
