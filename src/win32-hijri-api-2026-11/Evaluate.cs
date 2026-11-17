// win32-hijri-api-2026-11 evaluator (Kernel32 deprecated conversion APIs)
//
// usage (image is windows-latest; this file is the evaluation tool, NOT the target):
//   Evaluate.exe probe              ... function availability + supported range (GetCalendarSupportedDateRange)
//   Evaluate.exe golden             ... G 2026-11-17 -> H 1448-06-07 and H->G roundtrip (hijri only)
//   Evaluate.exe g2h <hijri|uaq>    ... G -> H full domain (G 1601-01-01..G 9999-12-31)
//   Evaluate.exe h2g <hijri|uaq>    ... H -> G full domain (H 0001-01-01..H 9666-04-03, day grid 1..32)
//
// Calendar IDs (see MS docs "Calendar Identifiers"):
//   hijri = 6  (CAL_HIJRI, "Arabic Lunar")
//   uaq   = 23 (CAL_UMALQURA, Um Al Qura, Vista+)
//
// API set (documented in "API-MS-Win-Core-calendar-l1-1-0.dll" / "Kernel32.dll" / "kernel32legacy.dll"):
//   ConvertSystemTimeToCalDateTime / ConvertCalDateTimeToSystemTime / GetCalendarSupportedDateRange
//   All are deprecated and lack headers/libs, so we resolve them dynamically with LoadLibrary + GetProcAddress.
//
// output:
//   g2h: <g>,<m>,<d>\t<h>,<m>,<d>
//   h2g: <h>,<m>,<d>\t<g>,<m>,<d>  (failing inputs are printed as "<h-tuple>\t!<absolute-error>")
//
// This program uses only Win32 APIs and never depends on OS settings.


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
    // Win32 CALLBACK convention (required on x86, explicit on x64)
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
        if (lib == IntPtr.Zero) // fall back to the legacy DLL documented alongside the primary one
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

    // Ask the API for the Era it uses for this calendar (single-era calendars differ:
    // .NET reports 1 for Hijri while Win32 may report 0 or 1).
    private static uint GetRefEra(uint calId)
    {
        Probe();
        if (_cvtGCal != null)
        {
            var g = new SYSTEMTIME { Year = 2026, Month = 11, Day = 17 };
            CALDATETIME c;
            if (ConvertGToCal(ref g, calId, out c)) return c.Era;
        }
        return 1; // fallback: assume 1 if the probe fails
    }

    private static uint CalIdOf(string name)
    {
        switch (name)
        {
            case "hijri": return CAL_HIJRI;
            case "uaq": return CAL_UMALQURA;
            default:
                throw new ArgumentException("calendar must be hijri or uaq");
        }
    }

    private static int Main(string[] args)
    {
        var mode = args.Length > 0 ? args[0] : "probe";

        if (mode == "diag")
        {
            Probe();
            PrintRange(CAL_HIJRI, "hijri");
            PrintRange(CAL_UMALQURA, "uaq");
            var g1 = new SYSTEMTIME { Year = 2026, Month = 11, Day = 17 };
            CALDATETIME c;
            if (ConvertGToCal(ref g1, CAL_HIJRI, out c))
            {
                Console.WriteLine("G(2026-11-17) -> CalId={0} Era={1} Year={2} Month={3} Day={4} DOW={5} Hour={6} Minute={7} Second={8} Tick={9}",
                    c.CalId, c.Era, c.Year, c.Month, c.Day, c.DayOfWeek, c.Hour, c.Minute, c.Second, c.Tick);
            }
            else
            {
                Console.WriteLine("G(2026-11-17) -> CONVERT FAILED, lastError={0}", GetLastError());
            }
            // Try H2G with every plausible Era value and print detailed diagnostics.
            for (uint era = 0u; era <= 2u; era++)
            {
                var hTest = new CALDATETIME { CalId = CAL_HIJRI, Era = era, Year = c.Year, Month = c.Month, Day = c.Day, Tick = c.Tick };
                SYSTEMTIME gOut;
                var ok = ConvertCalToG(ref hTest, out gOut);
                var e = GetLastError();
                Console.WriteLine("H2G era={0} ok={1} lastError={2} -> G {3}-{4:00}-{5:00} DOW={6} {7:D2}:{8:D2}:{9:D2} tick={10}",
                    era, ok, e, gOut.Year, gOut.Month, gOut.Day, gOut.DayOfWeek, gOut.Hour, gOut.Minute, gOut.Second, hTest.Tick);
            }
            // Try H2G from the tick we discovered (reuses ALL fields after the G2H fill)
            var hFull = new CALDATETIME { CalId = c.CalId, Era = c.Era, Year = c.Year, Month = c.Month, Day = c.Day, DayOfWeek = c.DayOfWeek, Hour = c.Hour, Minute = c.Minute, Second = c.Second, Tick = c.Tick };
            SYSTEMTIME gFull;
            var okFull = ConvertCalToG(ref hFull, out gFull);
            Console.WriteLine("H2G full-reuse ok={0} lastError={1} -> G {2}-{3:00}-{4:00}", okFull, GetLastError(), gFull.Year, gFull.Month, gFull.Day);
            return 0;
        }

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
            if (_cvtGCal == null) { Console.WriteLine("probe: failed to resolve delegates"); return 3; }
            var g = new SYSTEMTIME { Year = 2026, Month = 11, Day = 17 };
            CALDATETIME c;
            if (!ConvertGToCal(ref g, CAL_HIJRI, out c)) { Console.WriteLine("golden: CONVERT FAILED"); return 2; }
            Console.WriteLine("golden: G(2026-11-17) -> hijri {0}-{1}-{2} era {3} (expect 1448-06-07)", c.Year, c.Month, c.Day, c.Era);
            // Roundtrip anchor: the H date we just converted must map back to G 2026-11-17.
            // Use the Era value the API itself returned (Win32 may use 0 or 1 depending on the calendar).
            // (Note: H 1-01-01 = G 622-07-18 is below this API's documented floor of 1601-01-01,
            //  so it is out of the supported range by design.)
            var h = new CALDATETIME { CalId = CAL_HIJRI, Era = c.Era, Year = c.Year, Month = c.Month, Day = c.Day, Tick = c.Tick };
            SYSTEMTIME gRound;
            var roundtrip = ConvertCalToG(ref h, out gRound);
            Console.WriteLine("golden anchor: H2G roundtrip ok={0} lastError={1} -> G {2}-{3:00}-{4:00} (expect 2026-11-17)",
                roundtrip, GetLastError(), gRound.Year, gRound.Month, gRound.Day);
            return (c.Year == 1448 && c.Month == 6 && c.Day == 7) ? 0 : 2;
        }

        if (mode == "g2h" && args.Length == 2)
        {
            var calId = CalIdOf(args[1]);
            Probe();
            var t0 = new SYSTEMTIME { Year = 1601, Month = 1, Day = 1 };
            var t1 = new SYSTEMTIME { Year = 9999, Month = 12, Day = 31 };
            var g = t0;
            g.DayOfWeek = (ushort)(new DateTime(1601, 1, 1).DayOfWeek);
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
                g.DayOfWeek = (ushort)next.DayOfWeek;
            }
            return 0;
        }

        if (mode == "h2g" && args.Length == 2)
        {
            var calId = CalIdOf(args[1]);
            Probe();
            var era = GetRefEra(calId);
            Console.WriteLine("reference era for {0}: {1}", args[1], era);
            for (var y = 1u; y <= 9666u; y++)
            {
                for (var m = 1u; m <= 12u; m++)
                {
                    for (var d = 1u; d <= 32u; d++)
                    {
                        // CALDATETIME.DayOfWeek is validated strictly: the call only succeeds
                        // when it equals the actual weekday of the (out) SYSTEMTIME. The weekday
                        // is calendar-independent, but unknown before conversion, so try all 7.
                        bool ok = false;
                        uint lastErr = 0;
                        SYSTEMTIME g = new SYSTEMTIME();
                        for (uint dow = 0u; dow <= 6u && !ok; dow++)
                        {
                            var h = new CALDATETIME { CalId = calId, Era = era, Year = y, Month = m, Day = d, DayOfWeek = dow };
                            if (ConvertCalToG(ref h, out g)) { ok = true; }
                            else { lastErr = GetLastError(); }
                        }
                        if (ok)
                        {
                            Console.WriteLine("{0},{1},{2}\t{3},{4},{5}", y, m, d, g.Year, g.Month, g.Day);
                        }
                        else
                        {
                            Console.WriteLine("{0},{1},{2}\t!{3}", y, m, d, lastErr);
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
