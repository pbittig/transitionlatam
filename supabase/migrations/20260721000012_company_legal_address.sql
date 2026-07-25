-- El Formulario ya captura la dirección legal de la empresa (FormularioData.
-- companyLegalAddress) pero la columna nunca existió — getOrCreateCompany
-- recibía el dato y lo descartaba en silencio. Preparación para fase 2 (cruce
-- de dueños vía SII) mencionada por ONIX.

alter table company add column if not exists legal_address text;
