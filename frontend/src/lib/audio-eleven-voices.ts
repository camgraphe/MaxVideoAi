/** Reviewed 2026-10-17: fal v4 examples intersected with ElevenLabs' current public stock catalog.
 * Voice IDs are provider inputs, not model-registry identities. Preview URLs are resolved live.
 * No inference calls were made to qualify this catalog; it is documented provider availability.
 */
export const AUDIO_ELEVEN_V4_MODEL_ID = 'elevenlabs/tts/eleven-v4';
export const DEFAULT_ELEVEN_VOICE_ID = 'nPczCjzI2devNBz1zQrb';
export const AUDIO_ELEVEN_VOICES = [
  {
    "id": "Xb7hH8MSUJpSbSDYk0k2",
    "name": "Alice",
    "gender": "female",
    "accent": "british",
    "language": "en",
    "description": "Clear and engaging, friendly woman with a British accent suitable for e-learning."
  },
  {
    "id": "pqHfZKP75CvOlQylNhV4",
    "name": "Bill",
    "gender": "male",
    "accent": "american",
    "language": "en",
    "description": "Friendly and comforting voice ready to narrate your stories."
  },
  {
    "id": "nPczCjzI2devNBz1zQrb",
    "name": "Brian",
    "gender": "male",
    "accent": "american",
    "language": "en",
    "description": "Middle-aged man with a resonant and comforting tone. Great for narrations and advertisements."
  },
  {
    "id": "N2lVS1w4EtoT3dr4eOWO",
    "name": "Callum",
    "gender": "male",
    "accent": "american",
    "language": "en",
    "description": "Deceptively gravelly, yet unsettling edge."
  },
  {
    "id": "IKne3meq5aSn9XLyUdCD",
    "name": "Charlie",
    "gender": "male",
    "accent": "australian",
    "language": "en",
    "description": "A young Australian male with a confident and energetic voice."
  },
  {
    "id": "iP95p4xoKVk53GoZ742B",
    "name": "Chris",
    "gender": "male",
    "accent": "american",
    "language": "en",
    "description": "Natural and real, this down-to-earth voice is great across many use-cases."
  },
  {
    "id": "onwK4e9ZLuTAKqWW03F9",
    "name": "Daniel",
    "gender": "male",
    "accent": "british",
    "language": "en",
    "description": "A strong voice perfect for delivering a professional broadcast or news story."
  },
  {
    "id": "cjVigY5qzO86Huf0OWal",
    "name": "Eric",
    "gender": "male",
    "accent": "american",
    "language": "en",
    "description": "A smooth tenor pitch from a man in his 40s - perfect for agentic use cases."
  },
  {
    "id": "JBFqnCBsd6RMkjVDRZzb",
    "name": "George",
    "gender": "male",
    "accent": "british",
    "language": "en",
    "description": "Warm resonance that instantly captivates listeners."
  },
  {
    "id": "cgSgspJ2msm6clMCkdW9",
    "name": "Jessica",
    "gender": "female",
    "accent": "american",
    "language": "en",
    "description": "Young and popular, this playful American female voice is perfect for trendy content."
  },
  {
    "id": "FGY2WhTYpPnrIDTdsKH5",
    "name": "Laura",
    "gender": "female",
    "accent": "american",
    "language": "en",
    "description": "This young adult female voice delivers sunny enthusiasm with a quirky attitude."
  },
  {
    "id": "TX3LPaxmHKxFdv7VOQHJ",
    "name": "Liam",
    "gender": "male",
    "accent": "american",
    "language": "en",
    "description": "A young adult with energy and warmth - suitable for reels and shorts."
  },
  {
    "id": "pFZP5JQG7iQjIQuC4Bku",
    "name": "Lily",
    "gender": "female",
    "accent": "british",
    "language": "en",
    "description": "Velvety British female voice delivers news and narrations with warmth and clarity."
  },
  {
    "id": "XrExE9yKIg1WjnnlVkGX",
    "name": "Matilda",
    "gender": "female",
    "accent": "american",
    "language": "en",
    "description": "A professional woman with a pleasing alto pitch. Suitable for many use cases."
  },
  {
    "id": "SAz9YHcvj6GT2YYXdXww",
    "name": "River",
    "gender": "neutral",
    "accent": "american",
    "language": "en",
    "description": "A relaxed, neutral voice ready for narrations or conversational projects."
  },
  {
    "id": "CwhRBWXzGAHq8TQ4Fs17",
    "name": "Roger",
    "gender": "male",
    "accent": "american",
    "language": "en",
    "description": "Easy going and perfect for casual conversations."
  },
  {
    "id": "EXAVITQu4vr4xnSDxMaL",
    "name": "Sarah",
    "gender": "female",
    "accent": "american",
    "language": "en",
    "description": "Young adult woman with a confident and warm, mature quality and a reassuring, professional tone."
  },
  {
    "id": "bIHbv24MWmeRgasZH58o",
    "name": "Will",
    "gender": "male",
    "accent": "american",
    "language": "en",
    "description": "Conversational and laid back."
  }
] as const;
export const AUDIO_ELEVEN_VOICE_IDS = AUDIO_ELEVEN_VOICES.map(voice => voice.id);
export function findElevenVoice(id: string | null | undefined) {
  return AUDIO_ELEVEN_VOICES.find(voice => voice.id === id);
}
