use yoyomusic_lib::services::lyrics::{active_line_at, parse_lrc};

#[test]
fn parses_lrc_timestamps() {
    let doc = parse_lrc("[00:01.00]第一句\n[00:03.50]第二句").unwrap();

    assert_eq!(doc.lines.len(), 2);
    assert_eq!(doc.lines[0].time_ms, 1000);
    assert_eq!(doc.lines[1].time_ms, 3500);
}

#[test]
fn finds_active_line_with_offset() {
    let mut doc = parse_lrc("[00:01.00]第一句\n[00:03.00]第二句").unwrap();
    doc.offset_ms = 500;

    let line = active_line_at(&doc, 3600).unwrap();

    assert_eq!(line.text, "第二句");
}
