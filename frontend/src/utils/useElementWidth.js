import { useEffect, useState } from 'react';

// Đo bề rộng 1 phần tử (callback ref, chạy cả khi phần tử mount muộn): const [ref, width] = useElementWidth()
export default function useElementWidth() {
  const [node, setNode] = useState(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!node) return undefined;
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [setNode, width];
}
