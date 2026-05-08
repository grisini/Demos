import { evaluateInitiative } from "../domain/validation.js";

const author = { id: "demo-author", name: "Projektna ekipa Demos" };

function initiative(base) {
  return {
    ...base,
    author,
    aiReview: evaluateInitiative(base),
    updatedAt: base.createdAt,
    votes: base.votes || [],
    signatures: base.signatures || [],
    comments: base.comments || []
  };
}

export const demoInitiatives = [
  initiative({
    id: "demo-1",
    title: "Javna sledljivost sprememb zakonodajnih predlogov",
    category: "Digitalna drzava",
    summary:
      "Pobuda predlaga enoten javni pregled vseh sprememb zakonodajnih predlogov od prve objave do sprejema.",
    description:
      "Drzavljani pogosto tezko sledijo temu, kako se zakonodajni predlog spremeni med javno obravnavo, vladnim postopkom in obravnavo v Drzavnem zboru. Predlagamo javno digitalno sled, ki za vsak zakon prikaze izvorno besedilo, spremembe po fazah, predlagatelje dopolnil ter obrazlozitve. Sistem bi omogocal iskanje po clenu, primerjavo verzij in izvoz povzetka sprememb.",
    legalReference: "Zakon o dostopu do informacij javnega znacaja, poslovnik DZ",
    expectedImpact:
      "Vecja transparentnost postopkov, lazje spremljanje sprememb in bolj informirana javna razprava.",
    status: "active",
    createdAt: "2026-04-20T09:00:00.000Z",
    votes: [
      { userId: "u1", userName: "Ana", createdAt: "2026-04-21T10:00:00.000Z" },
      { userId: "u2", userName: "Marko", createdAt: "2026-04-21T11:30:00.000Z" },
      { userId: "u3", userName: "Tina", createdAt: "2026-04-22T08:20:00.000Z" }
    ],
    signatures: [{ userId: "u1", userName: "Ana", method: "demo", createdAt: "2026-04-22T12:10:00.000Z" }],
    comments: [
      {
        id: "c1",
        userId: "u2",
        userName: "Marko",
        body: "Koristno bi bilo dodati tudi obvestila ob spremembah posameznega clena.",
        createdAt: "2026-04-23T08:00:00.000Z"
      }
    ]
  }),
  initiative({
    id: "demo-2",
    title: "Obvezna objava strojno berljivih javnih razpisov",
    category: "Digitalna drzava",
    summary:
      "Pobuda zahteva, da so javni razpisi poleg PDF objave dostopni tudi v strojno berljivi obliki.",
    description:
      "Javni razpisi so pogosto objavljeni v razlicnih formatih, zato jih drzavljani, podjetja in nevladne organizacije tezko primerjajo. Predlog uvaja obvezno objavo osnovnih podatkov razpisa v strukturirani obliki, vkljucno z roki, pogoji, visino sredstev, pristojno institucijo in povezavami na dokumentacijo. S tem bi se izboljsala preglednost in ponovno uporabna vrednost javnih podatkov.",
    legalReference: "Zakon o javnem narocanju, Zakon o dostopu do informacij javnega znacaja",
    expectedImpact:
      "Hitrejse iskanje razpisov, vecja odprtost podatkov in manj rocnega prepisovanja informacij.",
    status: "signature_collection",
    createdAt: "2026-04-24T13:15:00.000Z",
    votes: [
      { userId: "u4", userName: "Luka", createdAt: "2026-04-25T10:10:00.000Z" },
      { userId: "u5", userName: "Sara", createdAt: "2026-04-25T14:40:00.000Z" }
    ],
    signatures: [
      { userId: "u4", userName: "Luka", method: "demo", createdAt: "2026-04-26T09:10:00.000Z" },
      { userId: "u5", userName: "Sara", method: "demo", createdAt: "2026-04-26T09:30:00.000Z" }
    ]
  }),
  initiative({
    id: "demo-3",
    title: "Neodvisen register cakalnih dob v zdravstvu",
    category: "Zdravstvo",
    summary:
      "Pobuda predlaga javni register cakalnih dob, ki prikaze primerljive podatke po izvajalcih in storitvah.",
    description:
      "Uporabniki zdravstvenega sistema potrebujejo pregleden vir podatkov o cakalnih dobah. Register bi moral prikazovati zadnjo posodobitev, metodologijo merjenja, razpolozljive termine, izvajalce in razlike med redno ter hitro obravnavo. Pobuda odpira tudi proracunska vprasanja, zato bi bila potrebna dodatna presoja izvedbenih stroskov.",
    legalReference: "Zakon o pacientovih pravicah",
    expectedImpact:
      "Bolj pregledno narocanje in manj informacijskih razlik med pacienti.",
    status: "review",
    createdAt: "2026-04-27T16:45:00.000Z",
    votes: [{ userId: "u6", userName: "Nina", createdAt: "2026-04-28T07:20:00.000Z" }]
  })
];
