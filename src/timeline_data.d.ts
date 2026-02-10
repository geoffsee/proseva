declare module "*/timeline_data.json" {
  const data: {
    events: Array<{
      date: string;
      party: string;
      title: string;
      details?: string;
      isCritical?: boolean;
      source?: string;
      case?: { number: string };
    }>;
  };
  export default data;
}
