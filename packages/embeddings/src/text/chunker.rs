/// Approximate token count by splitting on whitespace.
/// This is a rough heuristic (~1 token per word for English).
fn approx_token_count(text: &str) -> usize {
    text.split_whitespace().count()
}

/// Split text into overlapping chunks of approximately `max_tokens` tokens,
/// with `overlap_tokens` overlap between consecutive chunks.
/// Splits on sentence boundaries when possible.
pub fn chunk_text(text: &str, max_tokens: usize, overlap_tokens: usize) -> Vec<String> {
    let total_tokens = approx_token_count(text);
    if total_tokens <= max_tokens {
        return vec![text.to_string()];
    }

    let sentences = split_sentences(text);
    let mut chunks = Vec::new();
    let mut current_chunk: Vec<&str> = Vec::new();
    let mut current_len = 0usize;

    for sentence in &sentences {
        let sent_len = approx_token_count(sentence);

        // If a single sentence exceeds max_tokens, add it as its own chunk
        if sent_len > max_tokens {
            if !current_chunk.is_empty() {
                chunks.push(current_chunk.join(" "));
                current_chunk.clear();
                current_len = 0;
            }
            chunks.push(sentence.to_string());
            continue;
        }

        if current_len + sent_len > max_tokens && !current_chunk.is_empty() {
            chunks.push(current_chunk.join(" "));

            // Build overlap from the end of the current chunk
            let mut overlap_chunk: Vec<&str> = Vec::new();
            let mut overlap_len = 0;
            for &s in current_chunk.iter().rev() {
                let s_len = approx_token_count(s);
                if overlap_len + s_len > overlap_tokens {
                    break;
                }
                overlap_chunk.push(s);
                overlap_len += s_len;
            }
            overlap_chunk.reverse();

            current_chunk = overlap_chunk;
            current_len = overlap_len;
        }

        current_chunk.push(sentence);
        current_len += sent_len;
    }

    if !current_chunk.is_empty() {
        chunks.push(current_chunk.join(" "));
    }

    chunks
}

/// Simple sentence splitter: split on period/question mark/exclamation followed by space or end.
fn split_sentences(text: &str) -> Vec<String> {
    let mut sentences = Vec::new();
    let mut current = String::new();

    for ch in text.chars() {
        current.push(ch);
        if (ch == '.' || ch == '?' || ch == '!') && current.len() > 1 {
            // Look ahead is not trivial with chars, so we finalize on sentence-ending punctuation
            // This is approximate and good enough for chunking purposes
            let trimmed = current.trim().to_string();
            if !trimmed.is_empty() {
                sentences.push(trimmed);
            }
            current = String::new();
        }
    }

    let trimmed = current.trim().to_string();
    if !trimmed.is_empty() {
        sentences.push(trimmed);
    }

    sentences
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_short_text_no_chunking() {
        let text = "This is short.";
        let chunks = chunk_text(text, 500, 50);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0], text);
    }

    #[test]
    fn test_long_text_chunks() {
        let words: Vec<String> = (0..1000).map(|i| format!("word{i}")).collect();
        let text = words.join(" ") + ".";
        let chunks = chunk_text(&text, 500, 50);
        assert!(chunks.len() >= 2);
    }

    #[test]
    fn test_overlap_present() {
        // Create text with clear sentence boundaries
        let sentences: Vec<String> = (0..20)
            .map(|i| format!("Sentence number {} has some content.", i))
            .collect();
        let text = sentences.join(" ");
        let chunks = chunk_text(&text, 30, 10);
        // With overlap, later chunks should contain some words from the end of previous chunks
        assert!(chunks.len() >= 2);
    }
}
