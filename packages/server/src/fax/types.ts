export interface FaxSendOptions {
  recipientFax: string;
  recipientName: string;
  documentPath?: string;
  callerReference: string;
}

export interface FaxSendResult {
  success: boolean;
  providerJobId?: string;
  error?: string;
}

export interface FaxStatusResult {
  status: "pending" | "sending" | "sent" | "failed";
  error?: string;
}

export interface FaxProvider {
  name: string;
  sendFax(options: FaxSendOptions): Promise<FaxSendResult>;
  getStatus?(providerJobId: string): Promise<FaxStatusResult>;
  isConfigured(): boolean;
}
