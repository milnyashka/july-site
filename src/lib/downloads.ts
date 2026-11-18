export interface DownloadItem {
  id: string;
  name: string;
  description: string;
  fileName: string;
  version: string;
  size: string;
  platform: string;
  requiresKey: boolean;
  url: string;
}

export const downloads: DownloadItem[] = [
  {
    id: 'jule-bypass-4-5',
    name: 'Jule Bypass 4.7 - Free',
    description: 'Официальный обход July Bypass v4.7 для игры.',
    fileName: 'Jule-bypass-4.5.zip',
    version: '4.5',
    size: 'ZIP',
    platform: 'Windows 10/11',
    requiresKey: true,
        url: 'https://github.com/milnyashka/Jul-W-b/releases/download/v1.0/Kpt.Bypass.Free.zip',
  },
  {
    id: 'jule-hax-free-4-5',
      name: 'Jule Bypass 4.7 - Private',
      description: 'Официальный обход July Bypass v4.7 для игры.',
    fileName: 'jule-hax-free-4.5.rar',
    version: '4.5',
    size: 'RAR',
    platform: 'Windows 10/11',
    requiresKey: false,
      url: 'https://github.com/milnyashka/Jul-W-b/releases/download/v1.0/jule_bypass_vip.exe',
  },
  {
    id: 'jule-hax-private-4-5',
    name: 'Jule Hax Private 4.5',
    description: 'Приватная версия софта Jule Hax v4.5. Требуется лицензионный ключ.',
    fileName: 'jule-private-4.5.zip',
    version: '4.5',
    size: 'ZIP',
    platform: 'Windows 10/11',
    requiresKey: true,
    url: 'https://github.com/milnyashka/Jul-W-b/releases/download/v1.0/Jule.rar',
  },
  {
    id: 'gameloop-32',
    name: 'GameLoop 32-bit',
    description: 'Официальный установщик эмулятора GameLoop 32-bit для лучшей совместимости.',
    fileName: 'GLP_installer_1000218456_market.exe',
    version: '32-bit',
    size: 'EXE',
    platform: 'Windows 10/11',
    requiresKey: false,
    url: 'https://github.com/milnyashka/Jul-W-b/releases/download/v1.0/GLP_installer_1000218456_market.exe',
  },
  {
    id: 'vc-runtimes',
    name: 'Visual C++ Runtimes',
    description: 'Полный набор библиотек Visual C++ Runtimes All-in-One. Установите перед запуском.',
    fileName: 'Visual-C-Runtimes-All-in-One-Nov-2024.zip',
    version: 'Nov 2024',
    size: 'ZIP',
    platform: 'Windows 10/11',
    requiresKey: false,
    url: 'https://github.com/milnyashka/Jul-W-b/releases/download/v1.0/Visual-C-Runtimes-All-in-One-Nov-2024.zip',
  },
  {
    id: 'directx',
    name: 'DirectX Web Installer',
    description: 'Веб-установщик DirectX — необходим для корректной работы графики и софта.',
    fileName: 'dxwebsetup.exe',
    version: 'Latest',
    size: 'EXE',
    platform: 'Windows 10/11',
    requiresKey: false,
    url: 'https://github.com/milnyashka/Jul-W-b/releases/download/v1.0/dxwebsetup.exe',
  },
];
