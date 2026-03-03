interface TabsProps {
  tabs: string[];
  active: number;
  onChange: (index: number) => void;
}

export default function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="tabs">
      {tabs.map((tab, i) => (
        <button
          key={tab}
          className={`tab ${i === active ? 'tab-active' : ''}`}
          onClick={() => onChange(i)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
