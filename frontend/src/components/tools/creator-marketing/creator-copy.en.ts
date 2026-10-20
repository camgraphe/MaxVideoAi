import type { CreatorMarketingDictionary, CreatorMarketingLabels } from './creator-copy-types';

export const enLabels: CreatorMarketingLabels = {
  home: 'Home', tools: 'All tools', eyebrow: 'Tools for your next creation',
  open: 'Open the tool', how: 'How it works',
  inputs: '01 / Upload', settings: '02 / Make it yours', result: '03 / Download',
  workflow: 'Create in three steps.', limits: 'For a better result.', faq: 'Your questions, answered.',
  quoteTitle: 'See the price. Then decide.',
  quoteBody: 'Add your files and choose your settings. See the exact price before you confirm.',
  related: 'What will you create next?',
  illustration: 'Art direction · presentation visual — not a tool result',
  preview: 'Coming soon', demo: 'Explore the preview',
  photo: 'Photo', video: 'Video', voice: 'Voice', character: 'Character', performance: 'Movement',
  source: 'Starting point', after: 'Creative direction',
  caption: 'Try your own words', sample: 'Every word, at your pace.',
  style: 'Caption style', styles: ['Clean', 'Highlighted word', 'High contrast'],
  scene: 'Setting', scenes: ['Studio', 'In context', 'Lighting'],
  compare: 'Compare the two settings', sequence: 'Movement to follow',
  next: 'Bring your idea into view.', operation: 'Add captions. Give a voice. Set the scene. Animate.',
};

export const enCopy: CreatorMarketingDictionary = {
  subtitles: {
    name: 'Video subtitles',
    title: 'Caption your video. Every word, at your pace.',
    description: 'Add subtitles to your video: correct the text, adjust timing and style, then download SRT, VTT or a captioned MP4.',
    intro: 'Upload your video. Edit the words, adjust when they appear and choose their style. Export your subtitles as text or as part of the video.',
    input: 'A video with speech, or an audio file.',
    adjustment: 'The words, timing, size, style and position.',
    output: 'An SRT or VTT file, or your captioned video as an MP4.',
    steps: [
      'Upload your video or audio and choose the language.',
      'Review the captions, adjust their timing and choose how they look.',
      'Download SRT or VTT, or export the video with captions included.',
    ],
    limits: [
      'Add names and specialist terms before transcription to help recognize them. Check them before exporting.',
      'An audio file gives you SRT or VTT subtitles. A captioned MP4 needs a video.',
    ],
    questions: [
      { question: 'Can I edit the subtitles after transcription?', answer: 'Yes. Change the words, timing and style without transcribing again. After rewriting a line, check that it still follows the voice.' },
      { question: 'Which format should I choose?', answer: 'Use SRT or VTT to add subtitles in a player or video editor. A captioned MP4 includes the text in the video itself; this export is included with your transcription, with no additional charge.' },
    ],
  },
  'lip-sync': {
    name: 'Lip Sync',
    title: 'Make a portrait speak. Or give a video a new voice.',
    description: 'Animate a portrait with your voice or sync a video’s lips to new audio. Choose Photo or Video mode and add your recording.',
    intro: 'A face, a voice, a new line to deliver. Add your recording to a portrait or a face video and sync the lips to the words.',
    input: 'A portrait or a face video, plus a voice recording.',
    adjustment: 'Photo or Video mode and the audio passage to use.',
    output: 'A speaking video with the voice you chose.',
    steps: [
      'Choose Photo for a still portrait, or Video for a face already in motion.',
      'Add your voice recording and select the passage to deliver.',
      'Confirm the price, then watch and listen to the new video.',
    ],
    limits: [
      'Use a clearly visible face and a clean voice recording. Check the lips and facial features in the finished video.',
      'In Video mode, select audio and video passages of equal length. The tool does not loop or speed them up to make them fit.',
    ],
    questions: [
      { question: 'What is the difference between Photo and Video?', answer: 'Photo animates a still portrait to make it speak. Video adapts the lips of a filmed face to your new recording.' },
      { question: 'Can I use a generated voice?', answer: 'Yes. Select an audio file from your account or upload your recording. You choose the voice before starting the creation.' },
    ],
  },
  'product-photo-editor': {
    name: 'Product Photo Editor',
    title: 'Your product. A different setting.',
    description: 'Change the setting or lighting in your product photo. Choose a studio background, an everyday scene or a new lighting direction.',
    intro: 'A studio backdrop, an outdoor scene, more dramatic light. Start with your product photo and describe the image you want to create.',
    input: 'Your product photo, with an optional image for the setting.',
    adjustment: 'The setting, lighting, format and details to keep.',
    output: 'A new photo to compare and download.',
    steps: [
      'Upload a photo with a clear view of your product and its details.',
      'Choose the type of edit and describe the setting you have in mind.',
      'Compare the new image with your photo, then download it.',
    ],
    limits: [
      'Describe the details that matter: bottle shape, color, material. Check logos and lettering in the finished image.',
      'New lighting or perspective can change how the product looks. Start with one specific change so you can assess the result.',
    ],
    questions: [
      { question: 'Will the logo and label stay identical?', answer: 'AI editing can change small details or text. Describe what you want to keep, then check lettering at full size before using the image.' },
      { question: 'Can I animate the photo afterwards?', answer: 'Yes. Save the image and select it in a compatible video tool. Video creation has its own price, which you confirm separately.' },
    ],
  },
  'product-video-editor': {
    name: 'Product Video Editor',
    title: 'Change the setting. Start with the shot you have.',
    description: 'Edit a product video shot: choose a passage, describe a new setting, light or visual style, then compare the videos.',
    intro: 'Your product is already on camera. Select a passage and ask for a new setting, different lighting or another visual style.',
    input: 'A short product video with one continuous shot.',
    adjustment: 'The passage to edit, the look and whether to keep the sound.',
    output: 'A new video to compare with your original shot.',
    steps: [
      'Upload your video and select the passage to edit.',
      'Describe the change to the setting, lighting or style.',
      'Compare the two videos side by side and download the result.',
    ],
    limits: [
      'Use one continuous shot. Cuts, hands covering the product or fast movement can make the edit harder.',
      'Watch the full result: lettering, product shape and camera movement can change during the edit.',
    ],
    questions: [
      { question: 'Can I edit a whole advert?', answer: 'The tool works on one continuous shot. For an advert with several shots, edit each passage separately, then assemble the videos in Studio.' },
      { question: 'Can I keep my video’s sound?', answer: 'Yes. Choose to keep the original audio or mute it. Listen to the result before adding it to your edit.' },
    ],
  },
  'motion-transfer': {
    name: 'Motion Transfer',
    title: 'Give your character a move to follow.',
    description: 'Animate a character image with a filmed movement. Choose your character, a video passage and a way to guide the animation.',
    intro: 'A pose, a dance step, a gesture. Pair your character image with a movement video to create a new animation.',
    input: 'A character image and a video of the movement to follow.',
    adjustment: 'The passage, motion method, orientation and sound.',
    output: 'A character video inspired by your chosen movement.',
    steps: [
      'Choose an image that clearly shows your character and their pose.',
      'Add the movement video and select the passage to follow.',
      'Choose the method, confirm the price and watch your character move.',
    ],
    limits: [
      'Choose a video where the body stays visible. Hidden gestures and very fast movements are harder to follow.',
      'Check the face, hands and held objects. The character’s appearance and gestures can vary in the finished video.',
    ],
    questions: [
      { question: 'How do the two methods differ?', answer: 'Motion control uses a method dedicated to character movement. Video inspiration uses the clip as a general reference. The two methods do not reproduce movement in the same way.' },
      { question: 'Can I use a character from Character Builder?', answer: 'Yes. Select a saved image from Media. If you have a sheet with several views, first choose the single image you want to animate.' },
    ],
  },
};
