import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * 타이포 스케일 이름을 tailwind-merge 에 알려 준다.
 *
 * text-caption 같은 이름은 기본 스케일(text-sm …)에 없어서, tailwind-merge 가
 * "글자 색"으로 넘겨짚고 뒤에 오는 text-[color:…] 와 충돌한다고 보아 지워 버린다.
 * 실측: 상태 배지와 툴팁이 11px 대신 부모 크기(13/16px)로 렌더링됐다.
 * 스케일 이름을 등록하면 크기와 색이 서로 다른 그룹으로 갈려 둘 다 살아남는다.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["caption", "footnote", "body", "headline", "title", "display", "metric"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
