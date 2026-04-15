
import { Individual, Family, Gender, FamilyData } from '../types';

const individuals: Individual[] = [
  { 
    id: 'i1', 
    name: 'Queen Elizabeth II', 
    gender: Gender.Female, 
    birth: { date: '21 Apr 1926', place: 'Mayfair, London' }, 
    death: { date: '8 Sep 2022', place: 'Balmoral Castle' }, 
    photoUrl: 'https://picsum.photos/id/1027/200/200', 
    profession: 'Queen of the United Kingdom', 
    childInFamilyId: 'f0',
    education: [
      { id: 'edu1', title: 'Private Tutoring', description: 'Educated at home with her sister, Princess Margaret.', period: '1930s - 1940s' }
    ],
    works: [
      { id: 'work1', title: 'Monarch of the United Kingdom', description: 'Reigned for 70 years and 214 days, the longest of any British monarch.', period: '1952-2022' }
    ],
    sources: [
      { id: 'src1', title: 'Wikipedia', description: 'https://en.wikipedia.org/wiki/Elizabeth_II', period: '' }
    ],
    references: [
       { id: 'ref1', title: 'Royal Family Official Website', description: 'https://www.royal.uk/her-majesty-the-queen', period: '' }
    ]
  },
  { id: 'i2', name: 'Prince Philip', gender: Gender.Male, birth: { date: '10 Jun 1921', place: 'Corfu, Greece' }, death: { date: '9 Apr 2021', place: 'Windsor Castle' }, photoUrl: 'https://picsum.photos/id/1026/200/200', profession: 'Duke of Edinburgh' },
  { id: 'i3', name: 'King Charles III', gender: Gender.Male, birth: { date: '14 Nov 1948', place: 'Buckingham Palace' }, photoUrl: 'https://picsum.photos/id/1025/200/200', profession: 'King of the United Kingdom', childInFamilyId: 'f1' },
  { id: 'i4', name: 'Diana Spencer', gender: Gender.Female, birth: { date: '1 Jul 1961', place: 'Sandringham' }, death: { date: '31 Aug 1997', place: 'Paris, France' }, photoUrl: 'https://picsum.photos/id/1015/200/200', profession: 'Princess of Wales' },
  { id: 'i5', name: 'Camilla Parker Bowles', gender: Gender.Female, birth: { date: '17 Jul 1947', place: 'London' }, photoUrl: 'https://picsum.photos/id/1016/200/200', profession: 'Queen Consort' },
  { id: 'i6', name: 'Prince William', gender: Gender.Male, birth: { date: '21 Jun 1982', place: 'St Mary\'s Hospital, London' }, photoUrl: 'https://picsum.photos/id/200/200/200', profession: 'Prince of Wales', childInFamilyId: 'f2' },
  { id: 'i7', name: 'Catherine Middleton', gender: Gender.Female, birth: { date: '9 Jan 1982', place: 'Reading, Berkshire' }, photoUrl: 'https://picsum.photos/id/201/200/200', profession: 'Princess of Wales' },
  { id: 'i8', name: 'Prince George', gender: Gender.Male, birth: { date: '22 Jul 2013', place: 'St Mary\'s Hospital, London' }, photoUrl: 'https://picsum.photos/id/237/200/200', childInFamilyId: 'f4' },
  { id: 'i9', name: 'Princess Charlotte', gender: Gender.Female, birth: { date: '2 May 2015', place: 'St Mary\'s Hospital, London' }, photoUrl: 'https://picsum.photos/id/238/200/200', childInFamilyId: 'f4' },
  { id: 'i10', name: 'Prince Louis', gender: Gender.Male, birth: { date: '23 Apr 2018', place: 'St Mary\'s Hospital, London' }, photoUrl: 'https://picsum.photos/id/239/200/200', childInFamilyId: 'f4' },
  { id: 'i11', name: 'Prince Harry', gender: Gender.Male, birth: { date: '15 Sep 1984', place: 'St Mary\'s Hospital, London' }, photoUrl: 'https://picsum.photos/id/300/200/200', profession: 'Duke of Sussex', childInFamilyId: 'f2' },
  { id: 'i12', name: 'Meghan Markle', gender: Gender.Female, birth: { date: '4 Aug 1981', place: 'Canoga Park, California' }, photoUrl: 'https://picsum.photos/id/301/200/200', profession: 'Duchess of Sussex' },
  { id: 'i13', name: 'Archie Mountbatten-Windsor', gender: Gender.Male, birth: { date: '6 May 2019', place: 'The Portland Hospital, London' }, photoUrl: 'https://picsum.photos/id/305/200/200', childInFamilyId: 'f5' },
  { id: 'i14', name: 'Lilibet Mountbatten-Windsor', gender: Gender.Female, birth: { date: '4 Jun 2021', place: 'Santa Barbara, California' }, photoUrl: 'https://picsum.photos/id/306/200/200', childInFamilyId: 'f5' },
  { id: 'i15', name: 'Princess Anne', gender: Gender.Female, birth: { date: '15 Aug 1950', place: 'Clarence House, London' }, photoUrl: 'https://picsum.photos/id/400/200/200', childInFamilyId: 'f1' },
  { id: 'i16', name: 'Prince Andrew', gender: Gender.Male, birth: { date: '19 Feb 1960', place: 'Buckingham Palace' }, photoUrl: 'https://picsum.photos/id/401/200/200', childInFamilyId: 'f1' },
  { id: 'i17', name: 'Prince Edward', gender: Gender.Male, birth: { date: '10 Mar 1964', place: 'Buckingham Palace' }, photoUrl: 'https://picsum.photos/id/402/200/200', childInFamilyId: 'f1' },
  { id: 'i18', name: 'King George VI', gender: Gender.Male, birth: { date: '14 Dec 1895'}, death: { date: '6 Feb 1952'}, photoUrl: 'https://picsum.photos/id/500/200/200' },
  { id: 'i19', name: 'Queen Elizabeth The Queen Mother', gender: Gender.Female, birth: { date: '4 Aug 1900'}, death: { date: '30 Mar 2002'}, photoUrl: 'https://picsum.photos/id/501/200/200' },
];

const families: Family[] = [
  { id: 'f0', spouse1Id: 'i18', spouse2Id: 'i19', childrenIds: ['i1'] },
  { id: 'f1', spouse1Id: 'i2', spouse2Id: 'i1', marriage: { date: '20 Nov 1947', place: 'Westminster Abbey' }, childrenIds: ['i3', 'i15', 'i16', 'i17'] },
  { id: 'f2', spouse1Id: 'i3', spouse2Id: 'i4', marriage: { date: '29 Jul 1981' }, divorce: { date: '28 Aug 1996' }, childrenIds: ['i6', 'i11'] },
  { id: 'f3', spouse1Id: 'i3', spouse2Id: 'i5', marriage: { date: '9 Apr 2005' }, childrenIds: [] },
  { id: 'f4', spouse1Id: 'i6', spouse2Id: 'i7', marriage: { date: '29 Apr 2011' }, childrenIds: ['i8', 'i9', 'i10'] },
  { id: 'f5', spouse1Id: 'i11', spouse2Id: 'i12', marriage: { date: '19 May 2018' }, childrenIds: ['i13', 'i14'] },
];

export const initialFamilyData: FamilyData = {
  individuals: new Map(individuals.map(i => [i.id, i])),
  families: new Map(families.map(f => [f.id, f])),
  rootIndividualId: 'i1',
};
