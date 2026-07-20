-- Seed reference data for the Chile MVP.
-- Reference: /docs/04-modelo-datos.md §4.8-4.9 (fuentes confirmadas), /docs/DECISIONS.md ADR-011/ADR-015

insert into country (code, name) values ('CL', 'Chile');

insert into region (country_id, name)
select id, r.name from country, unnest(array[
  'Arica y Parinacota', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo',
  'Valparaíso', 'Metropolitana de Santiago', 'Libertador General Bernardo O''Higgins',
  'Maule', 'Ñuble', 'Biobío', 'La Araucanía', 'Los Ríos', 'Los Lagos',
  'Aysén', 'Magallanes y de la Antártica Chilena'
]) as r(name)
where country.code = 'CL';

insert into technology (code, name) values
  ('solar_pv', 'Solar'),
  ('wind', 'Eólico'),
  ('bess', 'Almacenamiento (Baterías)'),
  ('hybrid', 'Híbrido'),
  ('hydro', 'Hidroeléctrica'),
  ('pumped_hydro', 'Bombeo hidroeléctrico'),
  ('thermal', 'Térmica'),
  ('biomass', 'Biomasa'),
  ('geothermal', 'Geotérmica'),
  ('consumption', 'Consumo'),
  ('transmission', 'Transmisión');

insert into data_source (name, source_type, base_url) values
  ('Acceso Abierto - Coordinador Eléctrico Nacional (listado)', 'public_portal', 'https://accesoabierto.coordinador.cl'),
  ('Acceso Abierto - Coordinador Eléctrico Nacional (Formulario por proyecto)', 'public_portal', 'https://accesoabierto.coordinador.cl'),
  ('SEIA - Servicio de Evaluación Ambiental', 'public_portal', 'https://seia.sea.gob.cl/busqueda/buscarProyectoResumen.php');

-- Estados observados en dataset/solicitudes_muestra.xlsx (ver docs/04-modelo-datos.md §4.8)
insert into connection_status (code, label) values
  ('rechazada', 'Rechazada'),
  ('desistida', 'Desistida'),
  ('solicitud_ingresada', 'Solicitud Ingresada'),
  ('proyecto_autorizado_construccion', 'Proyecto autorizado para declararse en construcción'),
  ('proyecto_declarado_construccion', 'Proyecto declarado en construcción'),
  ('obra_menor', 'Clasificado como Obra Menor'),
  ('debe_presentar_suctd', 'Proyecto Fehaciente debe presentar SUCTD'),
  ('detenida_ingenieria', 'Detenida a la espera de definición de ingeniería de la obra'),
  ('desarrollo_estudios', 'Desarrollo de estudios y/o antecedentes'),
  ('elaboracion_informe_preliminar', 'Elaboración Informe de Autorización de Conexión Preliminar'),
  ('observaciones_informe_preliminar', 'Observaciones a Informe de Autorización de Conexión Preliminar'),
  ('detenida_info_tecnica', 'Detenida a la espera de información técnica del propietario de la instalación'),
  ('evaluacion_admisibilidad', 'Evaluación Admisibilidad'),
  ('periodo_discrepancias', 'Periodo de presentación de discrepancias'),
  ('revision_antecedentes', 'Revisión de antecedentes'),
  ('proyecto_finalizado', 'Proyecto finalizado'),
  ('evaluacion_requerimientos', 'Evaluación de antecedentes y/o requerimientos');

insert into feature (code, name) values
  ('advanced_filters', 'Filtros avanzados'),
  ('ai_extended', 'Transition AI ampliado'),
  ('opportunity_scoring', 'Opportunity Scoring'),
  ('company_intelligence', 'Company Intelligence'),
  ('custom_dashboards', 'Dashboards personalizados'),
  ('report_builder', 'Report Builder'),
  ('stakeholder_intelligence', 'Stakeholder Intelligence');
