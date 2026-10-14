// OS-level compositor/input probe. Only used by lyrics-window test scripts.
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
internal sealed class WindowProbe : Form {
    readonly JavaScriptSerializer json=new JavaScriptSerializer();
    readonly Queue<string> queue=new Queue<string>();
    readonly System.Windows.Forms.Timer timer=new System.Windows.Forms.Timer {Interval=20};
    readonly Color backdrop=Color.FromArgb(27,32,43);
    Point originalCursor;IntPtr originalForeground;int clicks;bool eof;
    [STAThread] static void Main() { Console.InputEncoding=new System.Text.UTF8Encoding(false);Console.OutputEncoding=new System.Text.UTF8Encoding(false);Application.Run(new WindowProbe()); }
    WindowProbe() {
        originalCursor=Cursor.Position;originalForeground=GetForegroundWindow();
        FormBorderStyle=FormBorderStyle.None;ShowInTaskbar=false;StartPosition=FormStartPosition.Manual;Bounds=new Rectangle(60,60,1100,360);BackColor=backdrop;Text="Lyrics OS test backdrop";
        MouseDown+=delegate {clicks++;};Shown+=delegate { Emit(new {type="ready",hwnd=Handle.ToInt64().ToString(),bounds=Box(Bounds),backdrop=new {r=27,g=32,b=43}});new Thread(Read) {IsBackground=true}.Start();};
        timer.Tick+=delegate { string line=null;lock(queue) {if(queue.Count>0)line=queue.Dequeue();else if(eof) {Close();return;}}if(line!=null)try {HandleCommand(json.Deserialize<Dictionary<string,object>>(line));}catch(Exception e){Emit(new {type="error",message=e.Message});} };timer.Start();
        FormClosed+=delegate {timer.Dispose();Cursor.Position=originalCursor;bool foregroundRestored=originalForeground==IntPtr.Zero||SetForegroundWindow(originalForeground);Emit(new {type="restored",cursorRestored=Cursor.Position==originalCursor,foregroundRestored=foregroundRestored,originalForeground=originalForeground.ToInt64().ToString(),currentForeground=GetForegroundWindow().ToInt64().ToString(),originalCursor=new {x=originalCursor.X,y=originalCursor.Y},currentCursor=new {x=Cursor.Position.X,y=Cursor.Position.Y}});};
    }
    void Read() {try {string s;while((s=Console.ReadLine())!=null)lock(queue)queue.Enqueue(s);}finally {lock(queue)eof=true;} }
    void Emit(object o) {Console.WriteLine(json.Serialize(o));Console.Out.Flush();}
    static int Number(Dictionary<string,object>d,string k) {return Convert.ToInt32(d[k]);}
    static object Box(Rectangle r) {return new {x=r.X,y=r.Y,width=r.Width,height=r.Height};}
    void HandleCommand(Dictionary<string,object>d) {
        string type=Convert.ToString(d["type"]);object id;d.TryGetValue("id",out id);
        if(type=="quit") {Close();return;}
        if(type=="inspect") {IntPtr h=new IntPtr(long.Parse(Convert.ToString(d["hwnd"])));RECT r;GetWindowRect(h,out r);Emit(new {type="inspectResult",id=id,style=GetWindowLongPtr(h,-16).ToInt64()&0xffffffffL,exStyle=GetWindowLongPtr(h,-20).ToInt64()&0xffffffffL,dpi=GetDpiForWindow(h),probeDpi=GetDpiForWindow(Handle),bounds=Box(Rectangle.FromLTRB(r.left,r.top,r.right,r.bottom))});return;}
        if(type=="move") {Cursor.Position=new Point(Number(d,"x"),Number(d,"y"));Emit(new {type="moveResult",id=id});return;}
        if(type=="click") {int x=Number(d,"x"),y=Number(d,"y"),before=clicks;Cursor.Position=new Point(x,y);IntPtr hit=WindowFromPoint(new POINT{x=x,y=y}),target=GetAncestor(hit,2);object expected;var allowed=d.TryGetValue("expectedHwnd",out expected)?expected as System.Collections.IEnumerable:null;bool safe=false;if(allowed!=null)foreach(object h in allowed)if(Convert.ToString(h)==target.ToInt64().ToString())safe=true;if(!safe)throw new InvalidOperationException("Refusing click on unexpected HWND "+target.ToInt64());mouse_event(2,0,0,0,UIntPtr.Zero);mouse_event(4,0,0,0,UIntPtr.Zero);var wait=new System.Windows.Forms.Timer {Interval=150};wait.Tick+=delegate {wait.Stop();wait.Dispose();Emit(new {type="clickResult",id=id,clicksBefore=before,clicksAfter=clicks,targetHwnd=target.ToInt64().ToString(),hitHwnd=hit.ToInt64().ToString(),probeHwnd=Handle.ToInt64().ToString()});};wait.Start();return;}
        if(type=="drag") { int x=Number(d,"x"),y=Number(d,"y");Cursor.Position=new Point(x,y);IntPtr hit=WindowFromPoint(new POINT{x=x,y=y}),target=GetAncestor(hit,2);if(target.ToInt64().ToString()!=Convert.ToString(d["expectedHwnd"]))throw new InvalidOperationException("Refusing drag on unexpected HWND "+target.ToInt64());mouse_event(2,0,0,0,UIntPtr.Zero);int step=0;var drag=new System.Windows.Forms.Timer {Interval=100};drag.Tick+=delegate {step++;if(step==1)Cursor.Position=new Point(Number(d,"toX"),Number(d,"toY"));else {mouse_event(4,0,0,0,UIntPtr.Zero);drag.Stop();drag.Dispose();Emit(new {type="dragResult",id=id,targetHwnd=target.ToInt64().ToString(),hitHwnd=hit.ToInt64().ToString()});}};drag.Start();return;}
        if(type=="capture") {
            var b=(Dictionary<string,object>)d["bounds"];Rectangle r=new Rectangle(Number(b,"x"),Number(b,"y"),Number(b,"width"),Number(b,"height"));r.Inflate(2,2);string filename=Path.GetFullPath(Convert.ToString(d["filename"]));Directory.CreateDirectory(Path.GetDirectoryName(filename));
            using(Bitmap bitmap=new Bitmap(r.Width,r.Height,PixelFormat.Format32bppArgb)) {
                using(Graphics g=Graphics.FromImage(bitmap))g.CopyFromScreen(r.Location,Point.Empty,r.Size,CopyPixelOperation.SourceCopy);
                int maxDelta=0,white=0,mismatches=0;Point ink=Point.Empty,opaqueInk=Point.Empty;bool hasInk=false,hasOpaqueInk=false;
                for(int y=0;y<Math.Min(4,r.Height);y++)for(int x=0;x<r.Width;x++) {Color c=bitmap.GetPixel(x,y);int delta=Math.Max(Math.Abs(c.R-backdrop.R),Math.Max(Math.Abs(c.G-backdrop.G),Math.Abs(c.B-backdrop.B)));maxDelta=Math.Max(maxDelta,delta);if(delta>4)mismatches++;if(c.R>235&&c.G>235&&c.B>235)white++;}
                for(int y=35;y<r.Height-10&&!hasInk;y++)for(int x=10;x<r.Width-10;x++) {Color c=bitmap.GetPixel(x,y);if(c.R>100||c.G>100||c.B>100) {ink=new Point(r.X+x,r.Y+y);hasInk=true;break;}}
                for(int y=35;y<r.Height-10&&!hasOpaqueInk;y++)for(int x=10;x<r.Width-10;x++){Color c=bitmap.GetPixel(x,y);if(c.R>=250&&c.G>=250&&c.B>=250){opaqueInk=new Point(r.X+x,r.Y+y);hasOpaqueInk=true;break;}}
                bitmap.Save(filename,ImageFormat.Png);
                int interiorWhite=0,exteriorWhite=0,interiorMismatch=0,exteriorMismatch=0;
                using(Bitmap edge=new Bitmap(r.Width,8,PixelFormat.Format32bppArgb)) {
                    using(Graphics g=Graphics.FromImage(edge))g.CopyFromScreen(new Point(r.X,r.Y-2),Point.Empty,edge.Size,CopyPixelOperation.SourceCopy);
                    for(int ey=0;ey<8;ey++)for(int ex=0;ex<r.Width;ex++) {Color c=edge.GetPixel(ex,ey);bool inside=ey>=4;int delta=Math.Max(Math.Abs(c.R-backdrop.R),Math.Max(Math.Abs(c.G-backdrop.G),Math.Abs(c.B-backdrop.B)));if(delta>4){if(inside)interiorMismatch++;else exteriorMismatch++;}if(c.R>235&&c.G>235&&c.B>235){if(inside)interiorWhite++;else exteriorWhite++;}}
                }
                Emit(new {type="captureResult",id=id,filename=filename,bounds=Box(r),topRowsMaxBackdropDelta=maxDelta,topRowsMismatchedPixels=mismatches,topRowsWhitePixels=white,interiorTopFourWhitePixels=interiorWhite,exteriorTopFourWhitePixels=exteriorWhite,interiorTopFourMismatchedPixels=interiorMismatch,exteriorTopFourMismatchedPixels=exteriorMismatch,hasInk=hasInk,hasOpaqueInk=hasOpaqueInk,opaqueInkPoint=new {x=opaqueInk.X,y=opaqueInk.Y},inkPoint=new {x=ink.X,y=ink.Y}});
            }return;
        }
        if(type=="stable") {
            var b=(Dictionary<string,object>)d["bounds"];Rectangle region=new Rectangle(Number(b,"x")+12,Number(b,"y")+40,Number(b,"width")-24,Number(b,"height")-52);
            int count=d.ContainsKey("count")?Number(d,"count"):12,interval=d.ContainsKey("interval")?Number(d,"interval"):250;
            if(count<2||count>60||interval<50||region.Width<1||region.Height<1)throw new ArgumentException("Invalid stable sample request");
            var samples=new List<object>();var fingerprints=new List<string>();int inkFrames=0;
            var sampler=new System.Windows.Forms.Timer {Interval=interval};sampler.Tick+=delegate {
                using(Bitmap image=new Bitmap(region.Width,region.Height,PixelFormat.Format32bppArgb)) {
                    using(Graphics g=Graphics.FromImage(image))g.CopyFromScreen(region.Location,Point.Empty,region.Size,CopyPixelOperation.SourceCopy);
                    byte[] pixels=new byte[region.Width*region.Height*3];int offset=0,inkPixels=0;
                    for(int y=0;y<region.Height;y++)for(int x=0;x<region.Width;x++){Color c=image.GetPixel(x,y);pixels[offset++]=c.R;pixels[offset++]=c.G;pixels[offset++]=c.B;if(c.R>150||c.G>150||c.B>150)inkPixels++;}
                    string fingerprint;using(SHA256 sha=SHA256.Create())fingerprint=BitConverter.ToString(sha.ComputeHash(pixels)).Replace("-","").ToLowerInvariant();
                    fingerprints.Add(fingerprint);if(inkPixels>20)inkFrames++;samples.Add(new {index=samples.Count,utc=DateTime.UtcNow.ToString("o"),fingerprint=fingerprint,inkPixels=inkPixels,hasInk=inkPixels>20});
                }
                if(samples.Count==count){sampler.Stop();sampler.Dispose();bool stable=true;foreach(string fingerprint in fingerprints)if(fingerprint!=fingerprints[0])stable=false;Emit(new {type="stableResult",id=id,region=Box(region),count=count,interval=interval,allHaveInk=inkFrames==count,exactPixelsStable=stable,samples=samples});}
            };sampler.Start();return;
        }
        throw new ArgumentException("Unknown probe command "+type);
    }
    [StructLayout(LayoutKind.Sequential)]struct POINT {public int x,y;}
    [StructLayout(LayoutKind.Sequential)]struct RECT {public int left,top,right,bottom;}
    [DllImport("user32.dll")]static extern IntPtr GetAncestor(IntPtr h,uint flags);
    [DllImport("user32.dll")]static extern IntPtr WindowFromPoint(POINT p);
    [DllImport("user32.dll")]static extern void mouse_event(uint flags,uint x,uint y,uint data,UIntPtr extra);
    [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")]static extern IntPtr GetWindowLongPtr(IntPtr h,int index);
    [DllImport("user32.dll")]static extern uint GetDpiForWindow(IntPtr h);
    [DllImport("user32.dll")]static extern bool GetWindowRect(IntPtr h,out RECT r);
    [DllImport("user32.dll")]static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]static extern bool SetForegroundWindow(IntPtr h);
}
