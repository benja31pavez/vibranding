/**
 * Columnas que las páginas públicas pueden leer. Nunca incluir client_id,
 * view_count, click_count, dominios ni datos internos: lo que se selecciona
 * aquí termina serializado en el HTML (datos del loader).
 */
export const LANDING_PUBLIC_COLUMNS =
  "id,slug,published,theme_color,hero_title,hero_subtitle,hero_image_url,cta_text,cta_url,services,gallery,contact_enabled,whatsapp_enabled,whatsapp_number,whatsapp_cta_text,whatsapp_message,template,dark_mode,hero_aspect,testimonials_enabled,testimonials,location_enabled,location,faq_enabled,faq,footer,seo_title,seo_description,section_order" as const;

export const MULTILINK_PUBLIC_COLUMNS =
  "id,slug,published,title,bio,avatar_url,theme_color,theme_mode,button_style,button_shape,font_family,background" as const;

export const MULTILINK_ITEM_PUBLIC_COLUMNS =
  "id,multilink_id,title,url,icon,sort_order,is_active,kind,featured,subtitle,thumbnail_url,wa_number,wa_message,video_url,start_at,end_at" as const;
