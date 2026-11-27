# FORGE MOTION — الصورة التي رمشت قبلي

مشروع فيلم رعب نفسي قصير أصلي مدته 60 ثانية، مرسوم بأسلوب 2D vector/cel-shading ومبني على شخصية ذات مفاصل مستقلة.

## محتويات المشروع

- `index.html` — معاينة تفاعلية داخل المتصفح: تشغيل، إيقاف، تحريك مؤشر الزمن، ومشاهدة ملف MP4 النهائي محليًا بعد اختياره من الجهاز.
- `storyboard.json` — خريطة اللقطات، توقيتاتها، مفاصل الشخصية، وأهداف التشويق.
- `captions.srt` — الترجمة العربية المتزامنة.
- `render.py` — مولّد الإطارات 2D والصوت الأصلي؛ لا يعتمد على مكتبات صور أو فيديو خارجية باستثناء Pillow وNumPy وFFmpeg.

## القصة

في الساعة 02:13 يكتشف آدم أن انعكاسه في المرآة لا يقلده كما ينبغي: يرمش قبله، يرفع يده قبله، ثم يكتب على الزجاج كلمة «اهرب». يتصاعد التهديد من حركة بصرية إلى صوت يأتي من خلفه، ثم تتوقف المرآة عن عكسه. في النهاية يختفي آدم، وينظر ما بقي في المرآة مباشرة إلى المشاهد.

## طريقة المشاهدة داخل FORGE Studio

1. افتح `studio/index.html` في FORGE Studio.
2. في خانة **Committed HTML entry file** أدخل: `workspace/one-minute-mirror/index.html`
3. في خانة **Branch** أدخل: `forge/projects/one-minute-mirror`
4. اضغط **OPEN COMMITTED PREVIEW**.
5. لمشاهدة ملف MP4 النهائي بصوته: نزّله من رابط الملف المرفق في المحادثة، ثم اختره من زر **تحميل MP4 النهائي للمعاينة هنا** داخل المشروع.

## إعادة إنتاج ملف MP4

المتطلبات: Python 3.11+، Pillow، NumPy، FFmpeg، وخط Noto Sans Arabic على Linux.

```bash
python -m pip install pillow numpy
sudo apt-get update && sudo apt-get install -y ffmpeg fonts-noto-core
python render.py --start 0 --end 0 --make-audio --write-srt
python render.py --start 0 --end 20 --output segment-01.mp4
python render.py --start 20 --end 40 --output segment-02.mp4
python render.py --start 40 --end 60 --output segment-03.mp4
```

أنشئ `concat.txt` بهذه الأسطر ثم اجمع الفيديو والصوت:

```text
file 'segment-01.mp4'
file 'segment-02.mp4'
file 'segment-03.mp4'
```

```bash
ffmpeg -y -f concat -safe 0 -i concat.txt -c copy silent-video.mp4
ffmpeg -y -i silent-video.mp4 -i sound-design.wav \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k \
  -af 'loudnorm=I=-17:TP=-1.5:LRA=10' -t 60 \
  -movflags +faststart the-reflection-blinked-first.mp4
```

## مواصفات ملف التسليم الذي تم التحقق منه

- 60.000 ثانية بالضبط.
- 1280×720، نسبة 16:9.
- H.264، 24fps (مصدر التحريك 12fps على التوأم).
- AAC Stereo، 48kHz.
- الترجمة العربية مدمجة داخل الصورة، مع ملف SRT جانبي.
- الشخصيات والبيئة والمؤثرات الصوتية مولّدة لهذا المشروع.

## ملاحظة إنتاجية

النسخة الحالية تعتمد على السرد المكتوب والمؤثرات والأجواء الصوتية الأصلية، ولا تحتوي على أداء صوتي بشري أو تعليق صوتي عربي. لم يتم الادعاء بوجود Lip-sync تلقائي. التحريك المفصلي مرسوم برمجيًا بمفاصل الكتف والمرفق والورك والركبة والكاحل، مع تعابير وجه واتجاه نظر وحركة كاميرا.