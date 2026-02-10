export interface CourtInfo {
  name: string;
  address: string;
  phone: string;
  website?: string;
}

export const VIRGINIA_COURTS: CourtInfo[] = [
  {
    name: "Fairfax County Circuit Court",
    address: "4110 Chain Bridge Rd, Fairfax, VA 22030",
    phone: "(703) 246-2644",
    website: "https://www.fairfaxcounty.gov/circuit/",
  },
  {
    name: "Arlington County Circuit Court",
    address: "1425 N Courthouse Rd, Arlington, VA 22201",
    phone: "(703) 228-7010",
    website: "https://courts.arlingtonva.us/circuit-court/",
  },
  {
    name: "Prince William County Circuit Court",
    address: "9311 Lee Ave, Manassas, VA 20110",
    phone: "(703) 792-6015",
  },
  {
    name: "Loudoun County Circuit Court",
    address: "18 E Market St, Leesburg, VA 20176",
    phone: "(703) 777-0270",
  },
  {
    name: "Richmond City Circuit Court",
    address: "400 N 9th St, Richmond, VA 23219",
    phone: "(804) 646-6505",
  },
  {
    name: "Virginia Beach Circuit Court",
    address: "2425 Nimmo Pkwy, Virginia Beach, VA 23456",
    phone: "(757) 385-4181",
  },
  {
    name: "Fairfax County JDR Court",
    address: "4000 Chain Bridge Rd, Fairfax, VA 22030",
    phone: "(703) 246-3367",
  },
  {
    name: "Arlington County JDR Court",
    address: "1425 N Courthouse Rd, Suite 5100, Arlington, VA 22201",
    phone: "(703) 228-4600",
  },
];
