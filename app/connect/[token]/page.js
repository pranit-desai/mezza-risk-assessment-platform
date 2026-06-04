import ConnectClient from './ConnectClient';

export const metadata = {
  title: 'Mezza secure bank connection',
  description: 'Connect your bank securely through Stripe Financial Connections.',
  openGraph: {
    title: 'Mezza secure bank connection',
    description: 'Connect your bank securely through Stripe Financial Connections.',
    siteName: 'Mezza',
  },
};

export default async function ConnectPage({ params }) {
  const { token } = await params;
  return <ConnectClient token={token} />;
}
