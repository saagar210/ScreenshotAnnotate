export function loadImageFromUrl(
  url: string,
  imageFactory: () => HTMLImageElement = () => new Image(),
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = imageFactory();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load screenshot for OCR'));
    image.src = url;
  });
}
