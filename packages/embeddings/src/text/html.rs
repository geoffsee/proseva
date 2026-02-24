use scraper::Html;

/// Strip HTML tags, decode entities, and normalize whitespace.
pub fn strip_html(input: &str) -> String {
    if input.is_empty() {
        return String::new();
    }

    // If it doesn't look like HTML, return as-is (with whitespace normalization)
    if !input.contains('<') {
        return normalize_whitespace(input);
    }

    let document = Html::parse_fragment(input);
    let text = document.root_element().text().collect::<Vec<_>>().join(" ");
    normalize_whitespace(&text)
}

fn normalize_whitespace(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_simple_html() {
        let input = "<p>Hello <b>world</b></p>";
        assert_eq!(strip_html(input), "Hello world");
    }

    #[test]
    fn test_strip_preserves_plain_text() {
        let input = "No HTML here";
        assert_eq!(strip_html(input), "No HTML here");
    }

    #[test]
    fn test_normalizes_whitespace() {
        let input = "<p>  too   many    spaces  </p>";
        assert_eq!(strip_html(input), "too many spaces");
    }

    #[test]
    fn test_empty_input() {
        assert_eq!(strip_html(""), "");
    }
}
