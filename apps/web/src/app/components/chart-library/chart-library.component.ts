import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

interface ChartLibraryItem {
  id: string;
  title: string;
  category: 'valuation' | 'cycle' | 'movingAverage' | 'macro';
  description: string;
  signal: string;
  thumbnailClass: string;
}

const CHARTS: ChartLibraryItem[] = [
  {
    id: 'stock-to-flow',
    title: 'Stock-to-Flow Model',
    category: 'valuation',

    signal: 'Szűkösségi értékelés',
    description:
      'A Bitcoin szűkösségét követi a forgalomban lévő kínálat és a kibocsátási ütem alapján, egyszerűsített modellárral a hosszú távú értékelési kontextushoz.',
    thumbnailClass: 'stock-to-flow',
  },
  {
    id: 'bitcoin-rainbow',
    title: 'Bitcoin szivárványárgrafikon',
    category: 'cycle',

    signal: 'Ciklusértékelési sávok',
    description:
      'Az árat logaritmikus ciklussávokhoz viszonyítja, hogy gyorsan láthatók legyenek a hűvösebb akkumulációs zónák és a túlfűtött piaci időszakok.',
    thumbnailClass: 'bitcoin-rainbow',
  },
  {
    id: 'pi-cycle-top',
    title: 'Pi Cycle Top Indicator',
    category: 'cycle',

    signal: 'Ciklustető keresztezés',
    description:
      'A 111 napos mozgóátlagot hasonlítja össze a 350 napos mozgóátlag kétszeresével, hogy lehetséges ciklustető-jelzéseket azonosítson.',
    thumbnailClass: 'pi-cycle-top',
  },
  {
    id: 'mvrv-z-score',
    title: 'MVRV Z-Score',
    category: 'valuation',

    signal: 'Piaci érték vs. realizált érték',
    description:
      'A Bitcoin piaci kapitalizációját hasonlítja a realizált kapitalizációhoz Z-Score segítségével, hogy statisztikailag szélsőséges túlértékeltségi és alulértékeltségi időszakokat jelezzen.',
    thumbnailClass: 'mvrv-z-score',
  },
  {
    id: 'puell-multiple',
    title: 'Puell Multiple',
    category: 'cycle',

    signal: 'Bányászbevételi ciklus',
    description:
      'A napi bányászbevételt méri a 365 napos mozgóátlagához képest, hogy felismerhetők legyenek a bányászati stressz (vétel) és a magas profitabilitás (eladás) időszakai.',
    thumbnailClass: 'puell-multiple',
  },
  {
    id: 'bitcoin-power-law',
    title: 'Bitcoin hatványtörvény grafikon',
    category: 'valuation',

    signal: 'Hosszú távú hatványtörvény trend',
    description:
      'A Bitcoin árát a genezis óta eltelt idő hatványfüggvényeként modellezi, történelmileg releváns alsó és felső sávokkal, amelyek sok ciklusban keretezték az ármozgást.',
    thumbnailClass: 'bitcoin-power-law',
  },
  {
    id: 'bitcoin-cvdd',
    title: 'Bitcoin CVDD',
    category: 'cycle',

    signal: 'Ciklusalj-jelzés',
    description:
      'A Cumulative Value Coin Days Destroyed az érmemozgások felhalmozott érték-idő mutatóját követi a piac korához képest. Történelmileg pontosan jelezte a Bitcoin nagyobb árfolyamaljait.',
    thumbnailClass: 'bitcoin-cvdd',
  },
  {
    id: 'halving-spiral',
    title: 'Bitcoin felezési spirál',
    category: 'cycle',

    signal: 'Cikluspozíció és lendület',
    description:
      'A Bitcoin árát polárdiagramon ábrázolja, ahol egy teljes kör egy felezési ciklusnak felel meg (~4 év). A logaritmikus radiális tengely egymásra helyezi a ciklusokat, így összevethetők a bikapiaci és medvepiaci fázisok.',
    thumbnailClass: 'halving-spiral',
  },
  {
    id: 'vdd-multiple',
    title: 'VDD Multiple',
    category: 'cycle',

    signal: 'Költési sebesség vs. éves átlag',
    description:
      'A Value Days Destroyed (CDD × ár) 30 napos mozgóátlagát hasonlítja a 365 napos átlaghoz. ' +
      'A 2,9 feletti csúcsok ciklustetőket jelezhetnek, ahol a hosszú távú tartók erősen adnak el; ' +
      'a 0,75 alatti értékek medvepiaci akkumulációs fázisokra utalnak.',
    thumbnailClass: 'vdd-multiple',
  },
  {
    id: 'halving-progress',
    title: 'Bitcoin felezési előrehaladás',
    category: 'cycle',

    signal: 'Ciklusok összehasonlítása',
    description:
      'A Bitcoin teljes ártörténetét mutatja az összes felezési cikluson át logaritmikus skálán. A ciklushátterek, felezési jelölők és előrehaladási mutató megmutatják, hol tart a jelenlegi ciklus a múltbeli ciklusok azonos szakaszához képest.',
    thumbnailClass: 'halving-progress',
  },
  {
    id: '2yr-ma-multiplier',
    title: '2 éves MA szorzó',
    category: 'movingAverage',

    signal: 'Vételi/eladási zóna 2 éves MA sávokkal',
    description:
      'Bitcoin befektetői eszköz: vétel a 2 éves mozgóátlag alatt (zöld), eladás a 2 éves MA × 5 felett (piros). ' +
      'A köztes szorzósávok (×2, ×3, ×4) a túlfűtöttség mértékét mutatják. Naponta számítva a teljes ártörténetből.',
    thumbnailClass: '2yr-ma-multiplier',
  },
  {
    id: 'price-forecast-tools',
    title: 'Ár-előrejelző eszközök',
    category: 'valuation',

    signal: 'Ciklustető- és aljcélárak',
    description:
      '6 modelles ár-előrejelzés: Top Cap, Delta Top, CVDD, Terminal Price, Balanced Price. ' +
      'On-chain modelleket kombinál, hogy történelmileg megbízható célárakat jelezzen Bitcoin ciklustetőkhöz és medvepiaci aljakhoz.',
    thumbnailClass: 'price-forecast-tools',
  },
  {
    id: 'mayer-multiple',
    title: 'Mayer Multiple',
    category: 'movingAverage',

    signal: 'Túlvett / túladott a 200 napos MA-hoz képest',
    description:
      'A Bitcoin árának aránya a 200 napos mozgóátlagához képest. A 2,4 feletti értékek történelmileg túlfűtöttséget, az 1,0 alatti értékek alulértékeltséget és hosszú távú akkumulációs lehetőséget jeleztek.',
    thumbnailClass: 'mayer-multiple',
  },
  {
    id: '200-week-ma-heatmap',
    title: '200 hetes MA hőtérkép',
    category: 'movingAverage',

    signal: 'Hosszú távú ciklusalj és felső tartomány',
    description:
      'Az ár a 200 hetes mozgóátlaghoz viszonyított arány alapján színezve. A 200 hetes MA történelmileg végső medvepiaci támaszként működött; a felette lévő színek a bikapiaci kiterjedés mértékét mutatják.',
    thumbnailClass: '200-week-ma-heatmap',
  },
  {
    id: 'fear-greed-index',
    title: 'Félelem és kapzsiság index',
    category: 'cycle',

    signal: 'Piaci hangulati szélsőségek',
    description:
      'Összetett hangulati pontszám (0-100) volatilitásból, volumenből, közösségi médiából és felmérésekből. Az extrém félelem történelmileg megbízható hosszú távú vételi jel volt; az extrém kapzsiság óvatosságra int.',
    thumbnailClass: 'fear-greed-index',
  },
  {
    id: 'hash-ribbons',
    title: 'Hash Ribbons',
    category: 'cycle',

    signal: 'Bányászkapituláció és helyreállás',
    description:
      'A Bitcoin hash rate 30 és 60 napos mozgóátlagát hasonlítja össze. Amikor a 30 napos átlag bányászkapituláció után visszakeresztezi a 60 napos fölé, történelmileg erős hosszú távú vételi jelzéseket adott.',
    thumbnailClass: 'hash-ribbons',
  },
  {
    id: 'difficulty-ribbon',
    title: 'Nehézségi szalag',
    category: 'cycle',

    signal: 'Bányászstressz nehézségi kompresszión keresztül',
    description:
      'A bányászati nehézség több mozgóátlaga (9-200 nap) szalagként rétegezve. Amikor a rövid távú MA-k a hosszabb távúak alá esnek, a szalag összenyomódik, ami bányászkapitulációt és történelmileg olcsó BTC-t jelezhet.',
    thumbnailClass: 'difficulty-ribbon',
  },
  {
    id: 'nvt-ratio',
    title: 'NVT Ratio',
    category: 'valuation',

    signal: 'A Bitcoin P/E mutatója',
    description:
      'Network Value to Transactions mutató: a Bitcoin piaci kapitalizációja osztva a napi on-chain tranzakciós volumennel. A magas NVT a használathoz képest túlértékelt hálózatot, az alacsony NVT alulértékeltséget jelezhet.',
    thumbnailClass: 'nvt-ratio',
  },
  {
    id: 'thermocap-multiple',
    title: 'Thermocap Multiple',
    category: 'valuation',

    signal: 'Piaci kapitalizáció vs. kumulatív bányászköltés',
    description:
      'Piaci kapitalizáció osztva a bányászok kumulatív teljes bevételével (Thermocap). Azt méri, mennyire drága a Bitcoin az eddigi teljes biztonsági ráfordításhoz képest. A történelmileg magas szorzók gyakran ciklustetőkkel estek egybe.',
    thumbnailClass: 'thermocap-multiple',
  },
  {
    id: 'excess-liquidity',
    title: 'Többletlikviditási előrejelző indikátor',
    category: 'macro',
    signal: 'Makrolikviditás vs. hozamgörbe',
    description:
      'A 3 hónapos/10 éves amerikai állampapír hozamkülönbözet 1 éves változását veti össze a 6 hónappal előretolt többletlikviditási indikátorral (M2 növekedés mínusz GDP-növekedés). ' +
      'Amikor a többletlikviditás pozitív és emelkedik, történelmileg lazább pénzügyi feltételeket és kockázatvállalóbb környezetet előzött meg.',
    thumbnailClass: 'excess-liquidity',
  },
  {
    id: 'spx-liquidity',
    title: 'S&P 500 vs Excess Liquidity',
    category: 'macro',
    signal: 'Részvények vs. makrolikviditás',
    description:
      'Az S&P 500 éves százalékos változását hasonlítja a többletlikviditási előrejelző indikátorhoz (M2 növekedés mínusz GDP-növekedés, 6 hónappal előretolva). ' +
      'Amikor a többletlikviditás pozitívba fordult, történelmileg körülbelül 6 hónappal előzte meg a részvénypiaci emelkedéseket.',
    thumbnailClass: 'spx-liquidity',
  },
];

const CATEGORY_LABELS: Record<ChartLibraryItem['category'], string> = {
  valuation: 'Értékelési modellek',
  cycle: 'Ciklusindikátorok',
  movingAverage: 'Mozgóátlagok',
  macro: 'Makróindikátorok',
};

const CATEGORIES: ChartLibraryItem['category'][] = ['valuation', 'cycle', 'movingAverage', 'macro'];

@Component({
  selector: 'app-chart-library',
  standalone: true,
  templateUrl: './chart-library.component.html',
})
export class ChartLibraryComponent {
  private readonly router = inject(Router);
  private readonly query = signal('');
  protected readonly searchQuery = this.query.asReadonly();
  private readonly filteredCharts = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q
      ? CHARTS.filter((c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
      : CHARTS;
  });
  protected readonly filteredCategories = computed(() =>
    CATEGORIES.map((category) => ({
      category: CATEGORY_LABELS[category],
      charts: this.filteredCharts().filter((c) => c.category === category),
    })).filter((group) => group.charts.length > 0),
  );

  protected updateSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected async openChart(chart: ChartLibraryItem): Promise<void> {
    await this.router.navigate(['/charts', chart.id]);
  }
}
