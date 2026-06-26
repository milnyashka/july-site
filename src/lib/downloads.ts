export type DownloadItem = {
  id: string;
  name: string;
  fileName: string;
  description: string;
  version: string;
  size: string;
  platform: 'Windows';
  url: string;
  requiresKey: boolean;
};

export const downloads: DownloadItem[] = [
  {
    id: 'directx',
    name: 'DirectX',
    fileName: 'dxwebsetup.exe',
    description: 'DirectX Web Installer — required runtime for July Bypass.',
    version: '1.0',
    size: '288 KB',
    platform: 'Windows',
    url: 'https://github.com/milnyashka/Jul-W-b/releases/download/v1.0/dxwebsetup.exe',
    requiresKey: false,
  },
  {
    id: 'visual-c-runtimes',
    name: 'Visual C++ Runtimes',
    fileName: 'Visual-C-Runtimes-All-in-One-Nov-2024.zip',
    description: 'Visual C++ Runtimes All-in-One — install before launching July Bypass.',
    version: 'Nov 2024',
    size: 'ZIP',
    platform: 'Windows',
    url: 'https://github.com/milnyashka/Jul-W-b/releases/download/v1.0/Visual-C-Runtimes-All-in-One-Nov-2024.zip',
    requiresKey: false,
  },
  {
    id: 'gameloop-32',
    name: 'GameLoop 32-bit',
    fileName: 'GLP_installer_1000218456_market.exe',
    description: 'GameLoop 32-bit installer for emulator environment setup.',
    version: '1.0',
    size: 'EXE',
    platform: 'Windows',
    url: 'https://github.com/milnyashka/Jul-W-b/releases/download/v1.0/GLP_installer_1000218456_market.exe',
    requiresKey: false,
  },
  {
    id: 'july-bypass',
    name: 'July Bypass',
    fileName: 'Jule-Bypass-Fixed.zip',
    description: 'July Bypass build — main package. Active license required.',
    version: '1.0',
    size: 'ZIP',
    platform: 'Windows',
    url: 'https://github.com/milnyashka/Jul-W-b/releases/download/v1.0/Jule-Bypass-Fixed.zip',
    requiresKey: true,
  },
];