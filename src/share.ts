export type ShareResult = 'shared' | 'copied' | 'failed';

/**
 * Shares a card's question via the native share sheet where available
 * (lets the player pick WhatsApp, Messages, etc. directly), falling back to
 * copying the text to the clipboard on desktop browsers that lack it.
 */
export async function shareCard(text: string): Promise<ShareResult> {
  const shareData = { title: 'Mandaly', text, url: location.href };

  if (navigator.share) {
    try {
      if (!navigator.canShare || navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return 'shared';
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'failed'; // player cancelled
    }
  }

  try {
    await navigator.clipboard.writeText(`${text}\n\n${location.href}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}
