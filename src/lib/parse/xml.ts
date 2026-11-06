export function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) throw new Error('Die Datei ist kein gültiges XML. Sie ist vermutlich beschädigt oder wurde nicht vollständig heruntergeladen.');
  return doc;
}

export function byLocal(root: Document | Element, localName: string): Element[] {
  const out: Element[] = [];
  const nodes = root.getElementsByTagName('*');
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes.item(index);
    if (node?.localName === localName) out.push(node);
  }
  return out;
}

export function childText(element: Element, localName: string): string | undefined {
  for (const child of element.children) {
    if (child.localName === localName) {
      const text = child.textContent?.trim();
      if (text) return text;
    }
  }
  return undefined;
}

export function nestedNumber(element: Element, localName: string): number | undefined {
  for (const child of element.children) {
    if (child.localName !== localName) continue;
    const value = [...child.children].find((item) => item.localName === 'Value');
    const parsed = Number((value ?? child).textContent?.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function firstNumber(element: Element, localName: string): number | undefined {
  const found = byLocal(element, localName)[0];
  if (!found) return undefined;
  const parsed = Number(found.textContent?.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function inside(element: Element, localName: string): boolean {
  let parent = element.parentElement;
  while (parent) {
    if (parent.localName === localName) return true;
    parent = parent.parentElement;
  }
  return false;
}

export function numberFrom(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}
