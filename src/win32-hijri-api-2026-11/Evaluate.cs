// win32-hijri-api-2026-11 評価器（Kernel32 の deprecated 変換 API）
//
// 使い方（image は windows-latest。このファイルはツールであって評価対象ではない）:
//   Evaluate.exe probe              … 関数の存在確認 + 対応年月日範囲（GetCalendarSupportedDateRange）
//   Evaluate.exe golden             … G 2026-11-17 -> H 1448-06-07 / H 1-01-01 -> G 622-07-18（hijri のみ・0終了で正常）
//   Evaluate.exe g2h <hijri|uaq>    … G -> H 全域（G 1601-01-01..G 9999-12-31）を変換
//   Evaluate.exe h2g <hijri|uaq>    … H -> G 全域（H 0001-01-01..H 9666-04-03、日 grid 1..32）
//
// 対象 calendar ID（Microsoft `Calendar Identifiers` ドキュメント）:
//   hijri = 6  （CAL_HIJRI  「Arabic Lunar」）
//   uaq   = 23 （CAL_UMALQURA 「Um Al Qura」。Windows Vista 以降）
//
// API 構成（ドキュメント「API-MS-Win-Core-calendar-l1-1-0.dll」「Kernel32.dll」「kernel32legacy.dll」）:
//   ConvertSystemTimeToCalDateTime / ConvertCalDateTimeToSystemTime / GetCalendarSupportedDateRange
//   いずれも deprecated でヘッダ・lib が無いため、LoadLibrary + GetProcAddress で動的取得する。
//
// 出力:
//   g2h: <g>,<m>,<d>\t<h>,<m>,<d>
//   h2g: <h>,<m>,<d>\t<g>,<m>,<d>（API が失敗した入力は `<h-tuple>\t!<GetLastError の数値>`）
//
// 本プログラムは Win32 API のみを使い、公開プロパティ等の OS 設定には依存しない。


using System;
using System.Runtime.InteropServices;

internal struct SYSTEMTIME
{
    public ushort Year;
    public ushort Month;
    public ushort DayOfWeek;
    public ushort Day;
    public ushort Hour;
    public ushort Minute;
    public ushort Second;
    public ushort Milliseconds;
}

internal struct CALDATETIME
{
    public uint CalId;
    public uint Era;
    public uint Year;
    public uint Month;
    public uint Day;
    public uint DayOfWeek;
    public uint Hour;
    public uint Minute;
    public uint Second;
    public uint Tick;
}

internal class Program
{
    // Win32 の CALLBACK 規約（x86 で必要、x64 では統一されているが明示）
    [UnmanagedFunctionPointer(CallingConvention.Winapi)]
    private delegate bool ConvertSystemTimeToCalDateTimeDelegate(ref SYSTEMTIME lpSysTime, uint calId, out CALDATETIME lpCalDateTime);

    [UnmanagedFunctionPointer(CallingConvention.Winapi)]
    private delegate bool ConvertCalDateTimeToSystemTimeDelegate(ref CALDATETIME lpCalDateTime, out SYSTEMTIME lpSysTime);

    [UnmanagedFunctionPointer(CallingConvention.Winapi)]
    private delegate bool GetCalendarSupportedDateRangeDelegate(uint Calendar, out CALDATETIME lpCalMinDateTime, out CALDATETIME lpCalMaxDateTime);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr LoadLibrary([MarshalAs(UnmanagedType.LPStr)] string lpFileName);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GetProcAddress(IntPtr hModule, [MarshalAs(UnmanagedType.LPStr)] string lpProcName);

    [DllImport("kernel32.dll")]
    private static extern uint GetLastError();

    private const uint CAL_HIJRI = 6;
    private const uint CAL_UMALQURA = 23;

    private static ConvertSystemTimeToCalDateTimeDelegate _cvtGCal = null;
    private static ConvertCalDateTimeToSystemTimeDelegate _cvtCalG = null;
    private static GetCalendarSupportedDateRangeDelegate _range = null;
    private static bool _probed = false;

    private static void Probe()
    {
        if (_probed) return;
        var lib = LoadLibrary("kernel32.dll");
        if (lib == IntPtr.Zero) // 念のため legacy に落とす（ドキュメントの別 DLL）
        {
            lib = LoadLibrary("kernel32legacy.dll");
        }
        Console.WriteLine("library handle: 0x{0:X}", lib.ToInt64());
        var a = GetProcAddress(lib, "ConvertSystemTimeToCalDateTime");
        var b = GetProcAddress(lib, "ConvertCalDateTimeToSystemTime");
        var c = GetProcAddress(lib, "GetCalendarSupportedDateRange");
        Console.WriteLine("GetProcAddress ConvertSystemTimeToCalDateTime = 0x{0:X}", a.ToInt64());
        Console.WriteLine("GetProcAddress ConvertCalDateTimeToSystemTime = 0x{0:X}", b.ToInt64());
        Console.WriteLine("GetProcAddress GetCalendarSupportedDateRange = 0x{0:X}", c.ToInt64());
        if (a != IntPtr.Zero) _cvtGCal = (ConvertSystemTimeToCalDateTimeDelegate)Marshal.GetDelegateForFunctionPointer(a, typeof(ConvertSystemTimeToCalDateTimeDelegate));
        if (b != IntPtr.Zero) _cvtCalG = (ConvertCalDateTimeToSystemTimeDelegate)Marshal.GetDelegateForFunctionPointer(b, typeof(ConvertCalDateTimeToSystemTimeDelegate));
        if (c != IntPtr.Zero) _range = (GetCalendarSupportedDateRangeDelegate)Marshal.GetDelegateForFunctionPointer(c, typeof(GetCalendarSupportedDateRangeDelegate));
        _probed = true;
    }

    private static bool ConvertGToCal(ref SYSTEMTIME g, uint calId, out CALDATETIME c)
    {
        Probe();
        if (_cvtGCal == null) { c = new CALDATETIME(); return false; }
        return _cvtGCal(ref g, calId, out c);
    }

    private static bool ConvertCalToG(ref CALDATETIME c, out SYSTEMTIME g)
    {
        Probe();
        if (_cvtCalG == null) { g = new SYSTEMTIME(); return false; }
        return _cvtCalG(ref c, out g);
    }

    private static void PrintRange(uint calId, string label)
    {
        Probe();
        if (_range == null) { Console.WriteLine("{0}: GetCalendarSupportedDateRange unavailable", label); return; }
        CALDATETIME min, max;
        if (_range(calId, out min, out max))
        {
            Console.WriteLine("{0}: range {1}-{2}-{3} .. {4}-{5}-{6} (era {7}..{8})", label, min.Year, min.Month, min.Day, max.Year, max.Month, max.Day, min.Era, max.Era);
        }
        else
        {
            Console.WriteLine("{0}: GetCalendarSupportedDateRange failed, lastError={1}", label, GetLastError());
        }
    }

    private static uint CalIdOf(string name)
    {
        switch (name)
        {
            case "hijri": return CAL_HIJRI;
            case "uaq": return CAL_UMALQURA;
            default:
                throw new ArgumentException("calendar は hijri | uaq のみ");
        }
    }

    private static int Main(string[] args)
    {
        var mode = args.Length > 0 ? args[0] : "probe";

        if (mode == "probe")
        {
            Probe();
            PrintRange(CAL_HIJRI, "hijri");
            PrintRange(CAL_UMALQURA, "uaq");
            return 0;
        }

        if (mode == "golden")
        {
            Probe();
            if (_cvtGCal == null) { Console.WriteLine("probe で委譲取得失敗"); return 3; }
            var g = new SYSTEMTIME { Year = 2026, Month = 11, Day = 17 };
            CALDATETIME c;
            if (!ConvertGToCal(ref g, CAL_HIJRI, out c)) { Console.WriteLine("golden: CONVERT FAILED"); return 2; }
            Console.WriteLine("golden: G(2026-11-17) -> hijri {0}-{1}-{2} (expect 1448-06-07)", c.Year, c.Month, c.Day);
            var h = new CALDATETIME { CalId = CAL_HIJRI, Era = 1, Year = 1, Month = 1, Day = 1 };
            if (!ConvertCalToG(ref h, out g)) { Console.WriteLine("golden anchor: CONVERT FAILED"); return 2; }
            Console.WriteLine("golden anchor: hijri 1-01-01 -> G {0}-{1:00}-{2:00} (expect 622-07-18)", g.Year, g.Month, g.Day);
            return (c.Year == 1448 && c.Month == 6 && c.Day == 7 && g.Year == 622 && g.Month == 7 && g.Day == 18) ? 0 : 2;
        }

        if (mode == "g2h" && args.Length == 2)
        {
            var calId = CalIdOf(args[1]);
            Probe();
            var t0 = new SYSTEMTIME { Year = 1601, Month = 1, Day = 1 };
            var t1 = new SYSTEMTIME { Year = 9999, Month = 12, Day = 31 };
            var g = t0;
            while (true)
            {
                CALDATETIME c;
                if (ConvertGToCal(ref g, calId, out c))
                {
                    Console.WriteLine("{0:0000},{1},{2}\t{3},{4},{5}", g.Year, g.Month, g.Day, c.Year, c.Month, c.Day);
                }
                else
                {
                    Console.WriteLine("{0:0000},{1},{2}\t!{3}", g.Year, g.Month, g.Day, GetLastError());
                }
                if (g.Year == t1.Year && g.Month == t1.Month && g.Day == t1.Day) break;
                var next = new DateTime(g.Year, g.Month, g.Day).AddDays(1);
                g.Year = (ushort)next.Year; g.Month = (ushort)next.Month; g.Day = (ushort)next.Day;
            }
            return 0;
        }

        if (mode == "h2g" && args.Length == 2)
        {
            var calId = CalIdOf(args[1]);
            Probe();
            for (var y = 1u; y <= 9666u; y++)
            {
                for (var m = 1u; m <= 12u; m++)
                {
                    for (var d = 1u; d <= 32u; d++)
                    {
                        var h = new CALDATETIME { CalId = calId, Era = 1, Year = y, Month = m, Day = d };
                        SYSTEMTIME g;
                        if (ConvertCalToG(ref h, out g))
                        {
                            Console.WriteLine("{0},{1},{2}\t{3},{4},{5}", y, m, d, g.Year, g.Month, g.Day);
                        }
                        else
                        {
                            Console.WriteLine("{0},{1},{2}\t!{3}", y, m, d, GetLastError());
                        }
                    }
                }
            }
            return 0;
        }

        Console.WriteLine("usage: Evaluate.exe probe | golden | g2h <hijri|uaq> | h2g <hijri|uaq>");
        return 64;
    }
}
