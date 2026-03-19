from PIL import Image
import os

# Android icon sizes for each mipmap folder
sizes = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192
}

src = 'src/assets/tovrika_logo.png'
res_dir = 'android/app/src/main/res'

for folder, size in sizes.items():
    out_dir = os.path.join(res_dir, folder)
    out_path = os.path.join(out_dir, 'ic_launcher.png')
    img = Image.open(src).convert('RGBA')
    img = img.resize((size, size), Image.LANCZOS)
    img.save(out_path)
    print(f'Saved {out_path}')
