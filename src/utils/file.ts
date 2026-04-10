import { ReceiptAsset } from '@/src/types';

const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'pdf'];

export const isAllowedReceiptFile = (asset: Pick<ReceiptAsset, 'name'>) => {
  const extension = asset.name.split('.').pop()?.toLowerCase() ?? '';
  return allowedExtensions.includes(extension);
};

export const inferMimeType = (name: string) => {
  const extension = name.split('.').pop()?.toLowerCase();

  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'bmp') return 'image/bmp';
  if (extension === 'png') return 'image/png';
  return 'image/jpeg';
};
