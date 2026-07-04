use std::collections::HashMap;

use crate::errors::AppError;

pub fn detect_duplicate_shortcuts(bindings: &[(String, String)]) -> Result<(), AppError> {
    let mut seen: HashMap<String, String> = HashMap::new();

    for (action, shortcut) in bindings {
        let normalized = normalize_shortcut(shortcut);
        if normalized.is_empty() {
            continue;
        }

        if let Some(existing_action) = seen.insert(normalized.clone(), action.clone()) {
            return Err(AppError::ShortcutConflict(format!(
                "{normalized} 同时绑定到 {existing_action} 和 {action}"
            )));
        }
    }

    Ok(())
}

fn normalize_shortcut(shortcut: &str) -> String {
    shortcut
        .split('+')
        .map(|part| part.trim().to_ascii_lowercase())
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("+")
}

#[cfg(test)]
mod tests {
    use super::detect_duplicate_shortcuts;

    #[test]
    fn detects_duplicate_shortcut_assignments() {
        let bindings = vec![
            ("toggle_playback".to_string(), "Ctrl+Alt+P".to_string()),
            ("next_track".to_string(), "Ctrl+Alt+P".to_string()),
        ];

        assert!(detect_duplicate_shortcuts(&bindings).is_err());
    }
}
