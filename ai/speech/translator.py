import asyncio
import threading
from backend.config import Settings

LANGUAGE_TAGS = {"hi": "hin_Deva", "ml": "mal_Mlym", "ta": "tam_Taml", "te": "tel_Telu"}


class TranslationError(Exception):
    pass


class IndicTransTranslator:
    """Dedicated IndicTrans2 adapter; model/tokenizer are loaded only once."""
    def __init__(self, settings: Settings):
        self.settings = settings
        self._model = self._tokenizer = self._processor = None
        self._lock = threading.Lock()

    def _load(self):
        if self._model is None:
            with self._lock:
                if self._model is None:
                    import torch
                    from IndicTransToolkit import IndicProcessor
                    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
                    self._tokenizer = AutoTokenizer.from_pretrained(self.settings.indictrans_model,
                                                                    trust_remote_code=True)
                    self._model = AutoModelForSeq2SeqLM.from_pretrained(self.settings.indictrans_model,
                                                                        trust_remote_code=True)
                    self._model = self._model.to(self.settings.indictrans_device).eval()
                    self._processor = IndicProcessor(inference=True)
        return self._model, self._tokenizer, self._processor

    def _run(self, text: str, source_language: str | None) -> str:
        if source_language == "en":
            return text
        source_tag = LANGUAGE_TAGS.get(source_language or "")
        if not source_tag:
            raise TranslationError(f"IndicTrans2 does not support detected language: {source_language or 'unknown'}")
        try:
            import torch
            model, tokenizer, processor = self._load()
            batch = processor.preprocess_batch([text], src_lang=source_tag, tgt_lang="eng_Latn")
            inputs = tokenizer(batch, truncation=True, padding="longest", return_tensors="pt").to(
                self.settings.indictrans_device)
            with torch.inference_mode():
                # The IndicTrans2 remote model's legacy cache implementation is
                # incompatible with recent Transformers releases. Disabling the
                # cache avoids a None past-key-value crash.
                generated = model.generate(**inputs, use_cache=False, min_length=0, max_new_tokens=48,
                                           repetition_penalty=1.1,
                                           num_beams=1, num_return_sequences=1)
            decoded = tokenizer.batch_decode(generated, skip_special_tokens=True,
                                             clean_up_tokenization_spaces=True)
            translated = processor.postprocess_batch(decoded, lang="eng_Latn")[0].strip()
        except TranslationError:
            raise
        except Exception as exc:
            raise TranslationError(f"IndicTrans2 translation failed: {exc}") from exc
        if not translated:
            raise TranslationError("IndicTrans2 returned an empty translation.")
        return translated

    async def translate_to_english(self, text: str, source_language: str | None) -> str:
        return await asyncio.to_thread(self._run, text, source_language)
