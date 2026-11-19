// macOS Foundation Calendar Islamic identifiers 評価データ生成器
//   使い方: evaluate <golden|g2h|h2g> <islamic|islamicCivil|islamicTabular|islamicUmmAlQura>
//
// 経路:
//   g2h: JDN を 1 日ずつ進め、ミリ秒整数から Date を作る（文字列パースなし）。
//        new Date 相当は Date(timeIntervalSince1970: jdn * 86400 + 43200)（正午 UTC、ミリ秒整数）。
//        それを Calendar(identifier:) で hijri の年月を dateComponents([.era,.year,.month,.day]) で取得。
//   h2g: cal.date(from: DateComponents(calendar: cal, era: 1, year: Hy, month, day)) で hijri の Date を作り、
//        gregorian Calendar で年月日を返す。
//   cal.range(of: .day, in: .month, for: date) で月長を取得する。
//
// 評価範囲:
//   g2h: G 621-07-18..G 9999-12-31（連続）＋ スポット窓（±2^15/16 = 32766..32770 / 65534..65538）
//        ⚠ 巨大年（±1.5e6/5e6/2^31/2^32）は評価対象外。Date の表現可能範囲は ±8.64e15 ms（≒±275760 年）に制限されるため。
//   h2g: H -1..H 9666（連続）＋ 同上スポット窓（H 32766..32770 / 65534..65538）
//        月長を超える day は `*` を記録（月長は range(of: .day) の count）
import Foundation

let utc = TimeZone(identifier: "UTC")!
var greg = Calendar(identifier: .gregorian)
greg.timeZone = utc

func floorDiv(_ a: Int64, _ b: Int64) -> Int64 {
    var q = a / b
    if a % b != 0 && ((a < 0) != (b < 0)) { q -= 1 }
    return q
}

func gregorianToJdn(_ y: Int64, _ m: Int64, _ d: Int64) -> Int64 {
    let a = floorDiv(14 - m, 12)
    let yy = y + 4800 - a
    let mm = m + 12 * a - 3
    return d + floorDiv(153 * mm + 2, 5) + 365 * yy + floorDiv(yy, 4) - floorDiv(yy, 100) + floorDiv(yy, 400) - 32045
}

func jdnToGregorian(_ jdn: Int64) -> (y: Int64, m: Int64, d: Int64) {
    var l = jdn + 68569
    let n = floorDiv(4 * l, 146097)
    l = l - floorDiv(146097 * n + 3, 4)
    let i = floorDiv(4000 * (l + 1), 1461001)
    l = l - floorDiv(1461 * i, 4) + 31
    let q = floorDiv(80 * l, 2447)
    let d = l - floorDiv(2447 * q, 80)
    l = floorDiv(q, 11)
    let m = q + 2 - 12 * l
    let y = 100 * (n - 49) + i + l
    return (y, m, d)
}

func isValidG(_ y: Int64, _ m: Int64, _ d: Int64) -> Bool {
    if m < 1 || m > 12 { return false }
    let leap = (y % 400 == 0) || (y % 4 == 0 && y % 100 != 0)
    let dim: [Int64] = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return d >= 1 && d <= dim[Int(m - 1)]
}

func calIdentifier(_ name: String) -> Calendar.Identifier? {
    switch name {
    case "islamic": return .islamic
    case "islamicCivil": return .islamicCivil
    case "islamicTabular": return .islamicTabular
    case "islamicUmmAlQura": return .islamicUmmAlQura
    default: return nil
    }
}

func makeCal(_ name: String) -> Calendar? {
    guard let id = calIdentifier(name) else { return nil }
    var cal = Calendar(identifier: id)
    cal.timeZone = utc
    return cal
}

func dayDate(_ jdn: Int64) -> Date {
    Date(timeIntervalSince1970: TimeInterval(jdn - 2440588) * 86400 + 43200) // 正午 UTC
}

func hTuple(_ cal: Calendar, _ date: Date) -> String {
    let co = cal.dateComponents([.era, .year, .month, .day], from: date)
    if let y = co.year, let m = co.month, let d = co.day {
        return "\(y),\(m),\(d)"
    }
    return "*"
}

func g2hLine(_ cal: Calendar, _ jdn: Int64) -> String {
    let (gy, gm, gd) = jdnToGregorian(jdn)
    return "\(gy),\(gm),\(gd)\t\(hTuple(cal, dayDate(jdn)))"
}

func g2hMain(_ cal: Calendar) {
    for j in MAIN_LO...MAIN_HI {
        print(g2hLine(cal, j))
    }
    for y in SPOT_YEARS {
        for m in Int64(1)...Int64(12) {
            for d in Int64(1)...Int64(32) {
                if !isValidG(y, m, d) { print("\(y),\(m),\(d)\t*"); continue }
                let dt = dayDate(gregorianToJdn(y, m, d))
                print("\(y),\(m),\(d)\t\(hTuple(cal, dt))")
            }
        }
    }
}

func comps(_ cal: Calendar, _ y: Int64, _ m: Int64, _ d: Int64) -> DateComponents {
    DateComponents(calendar: cal, era: 1, year: Int(y), month: Int(m), day: Int(d))
}

func gTuple(_ greg: Calendar, _ date: Date) -> String {
    let co = greg.dateComponents([.year, .month, .day], from: date)
    if let y = co.year, let m = co.month, let d = co.day {
        return "\(y),\(m),\(d)"
    }
    return "*"
}

func h2gLine(_ cal: Calendar, _ greg: Calendar, _ y: Int64, _ m: Int64, _ d: Int64) -> String {
    guard let dt = cal.date(from: comps(cal, y, m, d)) else {
        return "\(y),\(m),\(d)\t*"
    }
    return "\(y),\(m),\(d)\t\(gTuple(greg, dt))"
}

func monthLength(_ cal: Calendar, _ y: Int64, _ m: Int64) -> Int64 {
    guard let first = cal.date(from: comps(cal, y, m, 1)) else { return -1 }
    guard let r = cal.range(of: .day, in: .month, for: first) else { return -1 }
    return Int64(r.count)
}

func h2gMain(_ cal: Calendar) {
    for y0 in -1...9666 {
        let y = Int64(y0)
        for m in Int64(1)...Int64(12) {
            let len = monthLength(cal, y, m)
            for d in Int64(1)...Int64(32) {
                if len < 0 || d > len { print("\(y),\(m),\(d)\t*"); continue }
                print(h2gLine(cal, greg, y, m, d))
            }
        }
    }
    for y in SPOT_YEARS {
        for m in Int64(1)...Int64(12) {
            let len = monthLength(cal, y, m)
            for d in Int64(1)...Int64(32) {
                if len < 0 || d > len { print("\(y),\(m),\(d)\t*"); continue }
                print(h2gLine(cal, greg, y, m, d))
            }
        }
    }
}

let SPOT_YEARS: [Int64] = [
    32766, 32767, 32768, 32769, 32770,
    -32770, -32769, -32768, -32767, -32766,
    65534, 65535, 65536, 65537, 65538,
    -65538, -65537, -65536, -65535, -65534,
]
let MAIN_LO = gregorianToJdn(621, 7, 18)
let MAIN_HI = gregorianToJdn(9999, 12, 31)

func golden() -> Int32 {
    var failures: [String] = []
    // strict: islamicCivil G 2026-06-17 must be H 1448-01-01 (Kuwaiti Type II, ICU-compatible)
    if let civ = makeCal("islamicCivil") {
        let dt = dayDate(gregorianToJdn(2026, 6, 17))
        let s = hTuple(civ, dt)
        print("islamicCivil 2026-06-17 -> \(s)")
        if s != "1448,1,1" { failures.append("islamicCivil golden mismatch: got \(s), expect 1448,1,1") }
    }
    // informational (non-strict)
    for name in ["islamic", "islamicTabular", "islamicUmmAlQura"] {
        if let cal = makeCal(name) {
            let dt = dayDate(gregorianToJdn(2026, 6, 17))
            print("\(name) 2026-06-17 -> \(hTuple(cal, dt))")
            let dt1937 = dayDate(gregorianToJdn(1937, 3, 14))
            print("\(name) 1937-03-14 -> \(hTuple(cal, dt1937))")
        } else {
            print("\(name): identifier unavailable")
        }
    }
    if failures.isEmpty {
        print("golden: islamicCivil OK")
        return 0
    }
    for f in failures { print("MISMATCH: \(f)") }
    return 1
}

let args = CommandLine.arguments
guard args.count >= 3 else {
    FileHandle.standardError.write("usage: evaluate <golden|g2h|h2g> <cal>\n".data(using: .utf8)!)
    exit(2)
}
let op = args[1]
let name = args[2]

switch op {
case "golden":
    exit(golden())
case "g2h":
    guard let cal = makeCal(name) else {
        FileHandle.standardError.write("unknown calendar: \(name)\n".data(using: .utf8)!)
        exit(2)
    }
    g2hMain(cal)
case "h2g":
    guard let cal = makeCal(name) else {
        FileHandle.standardError.write("unknown calendar: \(name)\n".data(using: .utf8)!)
        exit(2)
    }
    h2gMain(cal)
default:
    FileHandle.standardError.write("usage: evaluate <golden|g2h|h2g> <cal>\n".data(using: .utf8)!)
    exit(2)
}
