declare module 'opencc-js' {
  export function Converter(options: { from: 'cn' | 'tw' | 'hk'; to: 'cn' | 'tw' | 'hk' }): (text: string) => string
}
