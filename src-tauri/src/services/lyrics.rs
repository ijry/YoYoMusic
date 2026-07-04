use uuid::Uuid;

use crate::{
    errors::AppError,
    models::{LyricsDocument, LyricsLine, LyricsSourceType},
};

pub fn parse_lrc(contents: &str) -> Result<LyricsDocument, AppError> {
    let mut lines = Vec::new();

    for raw_line in contents.lines() {
        let timestamps = parse_timestamps(raw_line);
        if timestamps.is_empty() {
            continue;
        }

        let text_start = raw_line.rfind(']').map(|index| index + 1).unwrap_or(0);
        let text = raw_line[text_start..].trim();
        if text.is_empty() {
            continue;
        }

        for time_ms in timestamps {
            lines.push(LyricsLine {
                time_ms,
                text: text.to_string(),
                translation: None,
            });
        }
    }

    lines.sort_by_key(|line| line.time_ms);

    Ok(LyricsDocument {
        id: Uuid::new_v4().to_string(),
        source_type: LyricsSourceType::LocalFile,
        language: "zh-CN".into(),
        offset_ms: 0,
        lines,
    })
}

pub fn active_line_at(document: &LyricsDocument, position_ms: u64) -> Option<LyricsLine> {
    let adjusted = position_ms as i64 + document.offset_ms;
    document
        .lines
        .iter()
        .take_while(|line| line.time_ms as i64 <= adjusted)
        .last()
        .cloned()
}

fn parse_timestamps(line: &str) -> Vec<u64> {
    let mut timestamps = Vec::new();
    let mut remaining = line;

    while let Some(start) = remaining.find('[') {
        let after_start = &remaining[start + 1..];
        let Some(end) = after_start.find(']') else {
            break;
        };
        let candidate = &after_start[..end];
        if let Some(timestamp) = parse_timestamp(candidate) {
            timestamps.push(timestamp);
        }
        remaining = &after_start[end + 1..];
    }

    timestamps
}

fn parse_timestamp(value: &str) -> Option<u64> {
    let (minutes, rest) = value.split_once(':')?;
    let (seconds, fraction) = rest.split_once('.').unwrap_or((rest, "0"));
    let minutes = minutes.parse::<u64>().ok()?;
    let seconds = seconds.parse::<u64>().ok()?;
    let fraction_ms = match fraction.len() {
        0 => 0,
        1 => fraction.parse::<u64>().ok()? * 100,
        2 => fraction.parse::<u64>().ok()? * 10,
        _ => fraction[..3].parse::<u64>().ok()?,
    };

    Some(minutes * 60_000 + seconds * 1000 + fraction_ms)
}
