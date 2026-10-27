import { BleachCalc } from './Bleach';
import { CprCard } from './Cpr';
import { TimersTool } from './Timers';
import { ConverterTool } from './Converter';
import { FlashlightTool, SosTool } from './Signal';
import { CompassTool } from './Compass';
import { WaterNeedTool } from './WaterNeed';
import { FuelRangeTool } from './FuelRange';
import { RadioTool } from './Radio';

export const TOOLS = [
  { id: 'cpr', title: 'CPR metronome', icon: 'heart', sub: '110 beats a minute, counts to 30' },
  { id: 'bleach', title: 'Bleach & water calculator', icon: 'drop', sub: 'CDC/EPA drops per gallon' },
  { id: 'timers', title: 'Timers', icon: 'timer', sub: 'Tourniquet, medication, checks' },
  { id: 'flashlight', title: 'Flashlight', icon: 'flash', sub: 'Phone light or screen light' },
  { id: 'sos', title: 'SOS light + whistle', icon: 'alert', sub: 'Flash SOS, three whistle blasts' },
  { id: 'compass', title: 'Compass & where am I', icon: 'compass', sub: 'Heading, coordinates, bearing to pins' },
  { id: 'radio', title: 'Radio frequencies', icon: 'radio', sub: 'NOAA, FRS/GMRS, 2 m calling' },
  { id: 'water', title: 'Water needs', icon: 'drop', sub: 'Gallons to store for you and the dog' },
  { id: 'fuel', title: 'Fuel range', icon: 'truck', sub: 'Miles left on the tank and cans' },
  { id: 'convert', title: 'Unit converter', icon: 'ruler', sub: 'Temperature, distance, volume, weight' },
];

export function ToolById({ id, minutes, label, embedded, preset }: { id: string; minutes?: number; label?: string; embedded?: boolean; preset?: string | null }) {
  switch (id) {
    case 'bleach': return <BleachCalc embedded={embedded} />;
    case 'cpr': return <CprCard />;
    case 'timer': return <TimersTool minutes={minutes} label={label} embedded />;
    case 'timers': return <TimersTool preset={preset} />;
    case 'convert': return <ConverterTool />;
    case 'flashlight': return <FlashlightTool />;
    case 'sos': return <SosTool />;
    case 'compass': return <CompassTool />;
    case 'water': return <WaterNeedTool />;
    case 'fuel': return <FuelRangeTool />;
    case 'radio': return <RadioTool />;
    default: return null;
  }
}
