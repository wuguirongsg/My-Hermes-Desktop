import { useRef, useEffect } from "react";

export interface RefItem {
  type: "file" | "skill";
  name: string;
  path?: string;
  content?: string;
  category?: string;
}

interface Props {
  fileItems: RefItem[];
  skillItems: RefItem[];
  selectedIndex: number;
  onSelect: (item: RefItem) => void;
}

export default function AtMentionMenu({ fileItems, skillItems, selectedIndex, onSelect }: Props) {
  const selectedRef = useRef<HTMLButtonElement>(null);
  const allItems = [...fileItems, ...skillItems];

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (allItems.length === 0) return null;

  let globalIdx = 0;

  return (
    <div className="slash-menu">
      {fileItems.length > 0 && (
        <div className="slash-menu-section">
          <div className="slash-menu-group">文件</div>
          {fileItems.map((item) => {
            const i = globalIdx++;
            const isSelected = i === selectedIndex;
            return (
              <button
                key={item.path ?? item.name}
                ref={isSelected ? selectedRef : null}
                className={`slash-menu-item${isSelected ? " selected" : ""}`}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onSelect(item); }}
              >
                <span className="slash-menu-cmd" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                  {item.name}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {skillItems.length > 0 && (
        <div className="slash-menu-section">
          <div className="slash-menu-group">技能</div>
          {skillItems.map((item) => {
            const i = globalIdx++;
            const isSelected = i === selectedIndex;
            return (
              <button
                key={item.name}
                ref={isSelected ? selectedRef : null}
                className={`slash-menu-item${isSelected ? " selected" : ""}`}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onSelect(item); }}
              >
                <span className="slash-menu-cmd">{item.name}</span>
                {item.category && (
                  <span className="slash-menu-desc">{item.category}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
