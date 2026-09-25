export const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    if (!file) {
        resolve('');
        return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || '');
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
});
