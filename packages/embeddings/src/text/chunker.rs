/// Approximate token count by splitting on whitespace.
/// This is a rough heuristic (~1 token per word for English).
fn approx_token_count(text: &str) -> usize {
    text.split_whitespace().count()
}

/// A chunk of text with its byte offsets into the original input.
#[derive(Debug, Clone)]
pub struct ChunkSpan {
    pub text: String,
    pub char_start: usize,
    pub char_end: usize,
}

/// A sentence with its byte offsets into the original input.
#[derive(Debug, Clone)]
struct SentenceSpan {
    text: String,
    byte_start: usize,
    byte_end: usize,
}

/// Split text into overlapping chunks of approximately `max_tokens` tokens,
/// with `overlap_tokens` overlap between consecutive chunks.
/// Splits on sentence boundaries when possible.
/// Returns spans with byte offsets into the original text.
pub fn chunk_text(text: &str, max_tokens: usize, overlap_tokens: usize) -> Vec<ChunkSpan> {
    let total_tokens = approx_token_count(text);
    if total_tokens <= max_tokens {
        return vec![ChunkSpan {
            text: text.to_string(),
            char_start: 0,
            char_end: text.len(),
        }];
    }

    let sentences = split_sentences(text);
    let mut chunks = Vec::new();
    let mut current_chunk: Vec<&SentenceSpan> = Vec::new();
    let mut current_len = 0usize;

    for sentence in &sentences {
        let sent_len = approx_token_count(&sentence.text);

        // If a single sentence exceeds max_tokens, force-split at word boundaries
        if sent_len > max_tokens {
            if !current_chunk.is_empty() {
                chunks.push(spans_to_chunk(&current_chunk));
                current_chunk.clear();
                current_len = 0;
            }
            chunks.extend(split_by_words(
                &sentence.text,
                sentence.byte_start,
                max_tokens,
                overlap_tokens,
            ));
            continue;
        }

        if current_len + sent_len > max_tokens && !current_chunk.is_empty() {
            chunks.push(spans_to_chunk(&current_chunk));

            // Build overlap from the end of the current chunk
            let mut overlap_chunk: Vec<&SentenceSpan> = Vec::new();
            let mut overlap_len = 0;
            for s in current_chunk.iter().rev() {
                let s_len = approx_token_count(&s.text);
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
        chunks.push(spans_to_chunk(&current_chunk));
    }

    chunks
}

fn spans_to_chunk(spans: &[&SentenceSpan]) -> ChunkSpan {
    let text = spans
        .iter()
        .map(|s| s.text.as_str())
        .collect::<Vec<_>>()
        .join(" ");
    let char_start = spans.first().map(|s| s.byte_start).unwrap_or(0);
    let char_end = spans.last().map(|s| s.byte_end).unwrap_or(0);
    ChunkSpan {
        text,
        char_start,
        char_end,
    }
}

/// Force-split a long sentence into chunks of `max_tokens` words with overlap.
/// Used when a sentence has no internal punctuation boundaries.
fn split_by_words(
    text: &str,
    base_offset: usize,
    max_tokens: usize,
    overlap_tokens: usize,
) -> Vec<ChunkSpan> {
    let words: Vec<(usize, &str)> = text
        .split_whitespace()
        .map(|w| {
            let offset = w.as_ptr() as usize - text.as_ptr() as usize;
            (offset, w)
        })
        .collect();

    if words.is_empty() {
        return vec![];
    }

    let mut chunks = Vec::new();
    let mut start = 0;

    while start < words.len() {
        let end = (start + max_tokens).min(words.len());
        let chunk_start = words[start].0;
        let last_word = words[end - 1];
        let chunk_end = last_word.0 + last_word.1.len();

        chunks.push(ChunkSpan {
            text: text[chunk_start..chunk_end].to_string(),
            char_start: base_offset + chunk_start,
            char_end: base_offset + chunk_end,
        });

        if end >= words.len() {
            break;
        }

        // Advance with overlap
        start = end.saturating_sub(overlap_tokens);
    }

    chunks
}

/// Simple sentence splitter: split on period/question mark/exclamation followed by space or end.
/// Tracks byte offsets into the original string.
fn split_sentences(text: &str) -> Vec<SentenceSpan> {
    let mut sentences = Vec::new();
    let mut current = String::new();
    let mut current_start: Option<usize> = None;

    for (byte_pos, ch) in text.char_indices() {
        // Track start of current sentence (first non-whitespace)
        if current_start.is_none() && !ch.is_whitespace() {
            current_start = Some(byte_pos);
        }

        current.push(ch);

        if (ch == '.' || ch == '?' || ch == '!') && current.len() > 1 {
            let trimmed = current.trim().to_string();
            if !trimmed.is_empty() {
                let start = current_start.unwrap_or(byte_pos);
                sentences.push(SentenceSpan {
                    text: trimmed,
                    byte_start: start,
                    byte_end: byte_pos + ch.len_utf8(),
                });
            }
            current = String::new();
            current_start = None;
        }
    }

    let trimmed = current.trim().to_string();
    if !trimmed.is_empty() {
        let start = current_start.unwrap_or(0);
        sentences.push(SentenceSpan {
            text: trimmed,
            byte_start: start,
            byte_end: text.len(),
        });
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
        assert_eq!(chunks[0].text, text);
        assert_eq!(chunks[0].char_start, 0);
        assert_eq!(chunks[0].char_end, text.len());
    }

    #[test]
    fn test_long_text_chunks() {
        // Create text with multiple sentence boundaries so chunking can split
        let sentences: Vec<String> = (0..100)
            .map(|i| format!("This is sentence number {} with some filler words.", i))
            .collect();
        let text = sentences.join(" ");
        let chunks = chunk_text(&text, 50, 10);
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

    #[test]
    fn test_chunk_offsets_cover_text() {
        let text = "First sentence. Second sentence. Third sentence.";
        let chunks = chunk_text(text, 3, 1);
        // Each chunk's offsets should be within the original text
        for chunk in &chunks {
            assert!(chunk.char_start <= chunk.char_end);
            assert!(chunk.char_end <= text.len());
        }
    }

    #[test]
    fn test_sentence_split_offsets() {
        let text = "Hello world. Goodbye world.";
        let sentences = split_sentences(text);
        assert_eq!(sentences.len(), 2);
        assert_eq!(sentences[0].text, "Hello world.");
        assert_eq!(sentences[0].byte_start, 0);
        assert_eq!(sentences[0].byte_end, 12);
        assert_eq!(sentences[1].text, "Goodbye world.");
        assert_eq!(&text[sentences[1].byte_start..sentences[1].byte_end], "Goodbye world.");
    }
}
