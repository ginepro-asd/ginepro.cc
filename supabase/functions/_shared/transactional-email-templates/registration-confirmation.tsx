import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const APP_URL = 'https://ginepro.lovable.app'

interface EventInfo {
  nome?: string
  data_evento?: string | null
  luogo?: string | null
  is_tesseramento?: boolean | null
}

interface CardInfo {
  id?: string | null
  card_number?: string | null
}

interface RegistrationConfirmationProps {
  nome?: string
  cognome?: string
  email?: string
  paymentMethod?: string
  event?: EventInfo | null
  card?: CardInfo | null
  participantId?: string | null
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'Da definire'

  const date = new Date(dateStr)
  const months = [
    'Gennaio',
    'Febbraio',
    'Marzo',
    'Aprile',
    'Maggio',
    'Giugno',
    'Luglio',
    'Agosto',
    'Settembre',
    'Ottobre',
    'Novembre',
    'Dicembre',
  ]

  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

function paymentLabel(paymentMethod?: string): string {
  switch (paymentMethod) {
    case 'stripe':
      return 'Carta di credito'
    case 'satispay':
      return 'Satispay'
    case 'paypal':
      return 'PayPal'
    default:
      return paymentMethod || 'Da definire'
  }
}

const RegistrationConfirmationEmail = ({
  nome,
  cognome,
  email,
  paymentMethod,
  event,
  card,
  participantId,
}: RegistrationConfirmationProps) => {
  const firstName = nome || 'Atleta'
  const fullName = [nome, cognome].filter(Boolean).join(' ') || 'Atleta Ginepro'
  const eventName = event?.nome || 'Evento Ginepro'
  const isTesseramento = Boolean(event?.is_tesseramento)
  const eventDate = formatDate(event?.data_evento)
  const cardLink = card?.id ? `${APP_URL}/card/${card.id}` : null
  const privateAreaLink = isTesseramento
    ? `${APP_URL}/area-riservata/setup${participantId ? `?participant_id=${participantId}` : ''}`
    : null

  return (
    <Html lang="it" dir="ltr">
      <Head />
      <Preview>
        {isTesseramento
          ? `Il tuo tesseramento ${eventName} è stato completato.`
          : `La tua iscrizione a ${eventName} è confermata.`}
      </Preview>
      <Body style={main}>
        <Container style={shell}>
          <Section style={hero}>
            <Text style={eyebrow}>GINEPRO ASD</Text>
            <Heading style={title}>
              {isTesseramento ? 'Tesseramento completato! ✅' : 'Iscrizione confermata! ✅'}
            </Heading>
            <Text style={lead}>
              Ciao <strong>{firstName}</strong>,
              {' '}
              {isTesseramento
                ? `il tuo tesseramento per ${eventName} è stato completato con successo.`
                : `la tua iscrizione a ${eventName} è stata completata con successo.`}
            </Text>
          </Section>

          <Section style={detailsCard}>
            <Text style={detailLabel}>Partecipante</Text>
            <Text style={detailValue}>{fullName}</Text>

            <Text style={detailLabel}>Email</Text>
            <Text style={detailValue}>{email || 'Non disponibile'}</Text>

            <Text style={detailLabel}>Pagamento</Text>
            <Text style={detailValue}>{paymentLabel(paymentMethod)}</Text>

            {!isTesseramento ? (
              <>
                <Text style={detailLabel}>Evento</Text>
                <Text style={detailValue}>{eventDate}</Text>
              </>
            ) : null}

            {event?.luogo ? (
              <>
                <Text style={detailLabel}>Luogo</Text>
                <Text style={detailValue}>{event.luogo}</Text>
              </>
            ) : null}

            {card?.card_number ? (
              <>
                <Text style={detailLabel}>N° Tessera</Text>
                <Text style={detailValue}>{card.card_number}</Text>
              </>
            ) : null}
          </Section>

          {cardLink ? (
            <Section style={ctaSection}>
              <Button href={cardLink} style={primaryButton}>
                Visualizza la tua tessera
              </Button>
            </Section>
          ) : null}

          {privateAreaLink ? (
            <Section style={ctaSection}>
              <Button href={privateAreaLink} style={secondaryButton}>
                Configura la tua area riservata
              </Button>
            </Section>
          ) : null}

          <Section style={footerCard}>
            <Text style={footerText}>
              {isTesseramento
                ? 'Conserva questa email come ricevuta del tuo tesseramento. Tessera digitale e area riservata resteranno disponibili dai link qui sopra.'
                : 'Conserva questa email come ricevuta della tua iscrizione. Ti contatteremo con eventuali dettagli aggiuntivi prima dell’evento.'}
            </Text>
            <Text style={footerMeta}>
              © {new Date().getFullYear()} Ginepro ASD · {APP_URL}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: RegistrationConfirmationEmail,
  subject: (data: Record<string, any>) => {
    const eventName = data.event?.nome || 'Evento Ginepro'
    const isTesseramento = Boolean(data.event?.is_tesseramento)
    return `${isTesseramento ? 'Tesseramento completato' : 'Iscrizione confermata'} — ${eventName}`
  },
  displayName: 'Conferma iscrizione',
  previewData: {
    nome: 'Domenico',
    cognome: 'Rossi',
    email: 'domenico@example.com',
    paymentMethod: 'satispay',
    event: {
      nome: 'Stampamondo 2026',
      data_evento: '2026-05-18',
      luogo: 'Tredozio',
      is_tesseramento: false,
    },
    card: null,
    participantId: null,
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif",
  margin: '0',
  padding: '32px 16px',
}

const shell = {
  margin: '0 auto',
  maxWidth: '600px',
}

const hero = {
  backgroundColor: '#1a606a',
  borderRadius: '24px',
  padding: '32px 28px',
  marginBottom: '18px',
}

const eyebrow = {
  color: '#ffadc0',
  fontSize: '12px',
  fontWeight: '700',
  letterSpacing: '0.18em',
  margin: '0 0 14px',
  textTransform: 'uppercase' as const,
}

const title = {
  color: '#ffffff',
  fontFamily: "'Outfit', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '30px',
  fontWeight: '800',
  lineHeight: '1.1',
  margin: '0 0 14px',
}

const lead = {
  color: '#e8f4f5',
  fontSize: '16px',
  lineHeight: '1.7',
  margin: '0',
}

const detailsCard = {
  backgroundColor: '#f4f8f8',
  border: '1px solid #dbe9eb',
  borderRadius: '20px',
  padding: '24px 22px 10px',
}

const detailLabel = {
  color: '#58787d',
  fontSize: '12px',
  fontWeight: '700',
  letterSpacing: '0.08em',
  margin: '0 0 4px',
  textTransform: 'uppercase' as const,
}

const detailValue = {
  color: '#14393f',
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '0 0 14px',
}

const ctaSection = {
  textAlign: 'center' as const,
  paddingTop: '18px',
}

const primaryButton = {
  backgroundColor: '#1a606a',
  borderRadius: '999px',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '700',
  padding: '14px 26px',
  textDecoration: 'none',
}

const secondaryButton = {
  backgroundColor: '#fff1f5',
  border: '1px solid #ffadc0',
  borderRadius: '999px',
  color: '#14393f',
  fontSize: '14px',
  fontWeight: '700',
  padding: '14px 26px',
  textDecoration: 'none',
}

const footerCard = {
  padding: '24px 8px 8px',
}

const footerText = {
  color: '#4f6a70',
  fontSize: '14px',
  lineHeight: '1.7',
  margin: '0 0 10px',
}

const footerMeta = {
  color: '#8aa0a4',
  fontSize: '12px',
  lineHeight: '1.6',
  margin: '0',
}