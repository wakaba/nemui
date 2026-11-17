// referencesource-windows-4.8 評価器（.NET Framework 4.8 の HijriCalendar を全域で動かす）
//
// usage:
//   Evaluate.exe golden              … G 2026-11-17 → H 1448-06-07 と G 622-07-18 → H 1-01-01 を確認（0 終了で正常）
//   Evaluate.exe g2h <adj>           … G -> H。全域（G 622-07-18..G 9999-12-31）を変換して出力
//   Evaluate.exe h2g <adj>           … H -> G。全域（H 0001-01-01..H 9666-04-03、日は 1..32）を変換して出力
//   <adj> は adj2n(-2) | adj1n(-1) | adj0(0) | adj1p(+1) | adj2p(+2)
//
// 出力:
//   g2h: <g>,<m>,<d>\t<h>,<m>,<d>
//   h2g: <h>,<m>,<d>\t<g>,<m>,<d>（公開 API が例外を投げた行は `<h-tuple>\t!<例外クラス名>`）
//
// 本プログラムは公開 API（HijriCalendar のプロパティ・メソッド・HijriEra）のみを使う。
// HijriAdjustment は明示的にセットする（システムレジストリの既定値には依存しない）。



using System;
using System.Globalization;

internal class Program
{
    static int Main(string[] args)
    {
        if (args.Length == 1 && args[0] == "golden")
        {
            var c = new HijriCalendar { HijriAdjustment = 0 };
            var d = new DateTime(2026, 11, 17);
            var ok = c.GetYear(d) == 1448 && c.GetMonth(d) == 6 && c.GetDayOfMonth(d) == 7;
            var anchor = c.ToDateTime(1, 1, 1, 0, 0, 0, 0, HijriCalendar.HijriEra);
            Console.WriteLine(string.Format("golden: G(2026-11-17) -> H {0}-{1}-{2} (expect 1448-6-7), anchor H 1-01-01 -> G {3:yyyy-MM-dd} (expect 622-07-18)",
                c.GetYear(d), c.GetMonth(d), c.GetDayOfMonth(d), anchor));
            return (ok && anchor == new DateTime(622, 7, 18)) ? 0 : 2;
        }

        if (args.Length != 2)
        {
            Console.WriteLine("usage: Evaluate.exe golden | (g2h|h2g) (adj2n|adj1n|adj0|adj1p|adj2p)");
            return 64;
        }
        var mode = args[0];
        var adjName = args[1];
        int adj;
        switch (adjName)
        {
            case "adj2n": adj = -2; break;
            case "adj1n": adj = -1; break;
            case "adj0":  adj = 0;  break;
            case "adj1p": adj = +1; break;
            case "adj2p": adj = +2; break;
            default:
                Console.WriteLine("adjustment は adj2n / adj1n / adj0 / adj1p / adj2p のみ");
                return 64;
        }

        var cal = new HijriCalendar { HijriAdjustment = adj };

        if (mode == "g2h")
        {
            var first = new DateTime(622, 7, 18);
            var last = new DateTime(9999, 12, 31);
            for (var ticks = first.Ticks; ticks <= last.Ticks; ticks += TimeSpan.TicksPerDay)
            {
                var d = new DateTime(ticks);
                try
                {
                    Console.WriteLine(string.Format("{0},{1},{2}\t{3},{4},{5}", d.Year, d.Month, d.Day, cal.GetYear(d), cal.GetMonth(d), cal.GetDayOfMonth(d)));
                }
                catch (ArgumentOutOfRangeException)
                {
                    Console.WriteLine(string.Format("{0},{1},{2}\t!ArgumentOutOfRangeException", d.Year, d.Month, d.Day));
                }
            }
            return 0;
        }
        if (mode == "h2g")
        {
            for (var y = 1; y <= 9666; y++)
            {
                for (var m = 1; m <= 12; m++)
                {
                    for (var d = 1; d <= 32; d++)
                    {
                        try
                        {
                            var dt = cal.ToDateTime(y, m, d, 0, 0, 0, 0, HijriCalendar.HijriEra);
                            Console.WriteLine(string.Format("{0},{1},{2}\t{3},{4},{5}", y, m, d, dt.Year, dt.Month, dt.Day));
                        }
                        catch (ArgumentOutOfRangeException)
                        {
                            Console.WriteLine(string.Format("{0},{1},{2}\t!ArgumentOutOfRangeException", y, m, d));
                        }
                    }
                }
            }
            return 0;
        }

        Console.WriteLine("mode は g2h | h2g のみ");
        return 64;
    }
}
