from pathlib import Path
from PIL import Image, ImageDraw
root=Path(__file__).resolve().parent
size=1024
image=Image.new('RGBA',(size,size))
pixels=image.load()
for y in range(size):
    for x in range(size):
        t=(x+y)/(size*2)
        pixels[x,y]=(int(103+57*t),int(66+35*t),int(215+32*t),255)
mask=Image.new('L',(size,size));ImageDraw.Draw(mask).rounded_rectangle((0,0,size-1,size-1),radius=240,fill=255)
image.putalpha(mask)
draw=ImageDraw.Draw(image)
draw.arc((165,180,760,795),65,295,fill=(248,245,255,255),width=85)
for x,top,bottom in [(430,350,675),(560,260,760),(690,380,640)]:
    draw.rounded_rectangle((x,top,x+66,bottom),radius=33,fill=(255,255,255,255))
image.resize((512,512),Image.Resampling.LANCZOS).save(root/'chenjin.png')
image.save(root/'chenjin.ico',sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
image.save(root/'chenjin.icns')
print('Generated original Chenjin brand icons')
