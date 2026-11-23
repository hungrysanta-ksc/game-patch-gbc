using System.Runtime.InteropServices;
static class Core {
 const string D="MesenCore.dll";
 [DllImport(D)]public static extern void InitDll();
 [DllImport(D)]public static extern void InitializeEmu([MarshalAs(UnmanagedType.LPUTF8Str)]string home,IntPtr w,IntPtr v,[MarshalAs(UnmanagedType.I1)]bool software,[MarshalAs(UnmanagedType.I1)]bool noAudio,[MarshalAs(UnmanagedType.I1)]bool noVideo,[MarshalAs(UnmanagedType.I1)]bool noInput);
 [DllImport(D)][return:MarshalAs(UnmanagedType.I1)]public static extern bool LoadRom([MarshalAs(UnmanagedType.LPUTF8Str)]string path,IntPtr patch);
 [DllImport(D)]public static extern void InitializeDebugger();
 [DllImport(D)]public static extern void Pause();
 [DllImport(D)][return:MarshalAs(UnmanagedType.I1)]public static extern bool IsExecutionStopped();
 [DllImport(D)][return:MarshalAs(UnmanagedType.I1)]public static extern bool IsPaused();
 [DllImport(D)]public static extern void Step(byte cpu,int count,int kind);
 [DllImport(D)]public static extern Timing GetTimingInfo(byte cpu);
 [DllImport(D)]public static extern byte GetMemoryValue(int type,uint address);
 [DllImport(D)]public static extern void SetMemoryValue(int type,uint address,byte value);
 [DllImport(D)]public static extern void GetMemoryValues(int type,uint start,uint end,[Out]byte[] data);
 [DllImport(D)]public static extern void Stop();
 [DllImport(D)]public static extern void Release();
 [DllImport(D)]public static extern void SetEmulationConfig(Speed config);
 [StructLayout(LayoutKind.Sequential)]public struct Speed{public uint speed,turbo,rewind,runahead;}
 [StructLayout(LayoutKind.Sequential)]public struct Timing{public double fps;public ulong clock;public uint rate,frame,lines;public int first;public uint cycles;}
}
