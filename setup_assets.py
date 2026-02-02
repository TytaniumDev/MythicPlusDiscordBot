import os
import requests
from PIL import Image, ImageDraw

def download_file(url, filename):
    print(f"Downloading {url} to {filename}...")
    try:
        response = requests.get(url, stream=True, timeout=10)
        if response.status_code == 200:
            with open(filename, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            print(f"Successfully downloaded {filename}")
        else:
            print(f"Failed to download {url}: Status {response.status_code}")
    except Exception as e:
        print(f"Error downloading {url}: {e}")

def generate_wheel_gif(filename):
    print(f"Generating spinning wheel GIF {filename}...")
    images = []
    width = 200
    height = 200
    steps = 12
    for i in range(steps):
        img = Image.new('RGBA', (width, height), (255, 255, 255, 0))
        draw = ImageDraw.Draw(img)
        # Draw a simple wheel
        center = (width // 2, height // 2)
        radius = 80
        angle_offset = (360 / steps) * i
        for j in range(8):
            start_angle = angle_offset + j * 45
            end_angle = start_angle + 45
            # alternating colors for the segments
            colors = [
                (255, 87, 51), (255, 189, 51), (219, 255, 51), (117, 255, 51),
                (51, 255, 189), (51, 189, 255), (87, 51, 255), (255, 51, 219)
            ]
            draw.pieslice([center[0]-radius, center[1]-radius, center[0]+radius, center[1]+radius],
                          start_angle, end_angle, fill=colors[j], outline="white")

        # Add a pointer at the top
        draw.polygon([(width//2 - 10, 5), (width//2 + 10, 5), (width//2, 25)], fill="black")

        # Add a center circle
        draw.ellipse([center[0]-5, center[1]-5, center[0]+5, center[1]+5], fill="white", outline="black")

        images.append(img)

    images[0].save(filename, save_all=True, append_images=images[1:], duration=80, loop=0)
    print(f"Successfully generated {filename}")

if __name__ == "__main__":
    assets_dir = "assets"
    if not os.path.exists(assets_dir):
        os.makedirs(assets_dir)
        print(f"Created directory {assets_dir}")

    # Sound effects from Google's Actions on Google sound library
    # These are reliable and CC-licensed
    download_file("https://actions.google.com/sounds/v1/tools_and_machines/mechanical_clock_ticking.ogg", os.path.join(assets_dir, "spin.ogg"))
    download_file("https://actions.google.com/sounds/v1/notifications/pizzicato_confirm.ogg", os.path.join(assets_dir, "reveal.ogg"))

    generate_wheel_gif(os.path.join(assets_dir, "wheel.gif"))
