// content-scripts/utils.ts

/**
 * Finds an input element on the page by its associated label text.
 * @param labelText The text to search for in the label.
 * @returns The found HTMLInputElement or null.
 */
export function findInputElementByLabelText(labelText: string): HTMLInputElement | null {
    const labels = document.querySelectorAll<HTMLLabelElement>('label.q-field');
    for (const label of Array.from(labels)) {
      const pElement = label.querySelector<HTMLParagraphElement>('.q-field__label p.text-weight-bold.text-body1');
      if (pElement) {
        const pClone = pElement.cloneNode(true) as HTMLParagraphElement;
        // Remove asterisk for required fields to match the label text correctly
        const asteriskSpan = pClone.querySelector('span.text-weight-bolder.text-negative');
        if (asteriskSpan) asteriskSpan.remove();
  
        if (pClone.textContent?.trim().startsWith(labelText)) {
          return label.querySelector<HTMLInputElement>('input.q-field__native');
        }
      }
    }
    return null;
  }