import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = createServiceClient();
    
    // 1. Ищем один свободный ключ (например, от тарифа '3h')
    const { data: keyData, error: fetchError } = await supabase
      .from('license_keys')
      .select('id, key')
      .eq('used', false)
      .eq('plan_id', '3h') // Замените на нужный plan_id, если нужно
      .limit(1)
      .single();

    if (fetchError || !keyData) {
      return NextResponse.json(
        { error: 'Свободные ключи закончились' }, 
        { status: 404 }
      );
    }

    // 2. Помечаем ключ как выданный
    const { error: updateError } = await supabase
      .from('license_keys')
      .update({ 
        used: true, 
        assigned_at: new Date().toISOString() 
      })
      .eq('id', keyData.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Ошибка при сохранении ключа' }, 
        { status: 500 }
      );
    }

    // 3. Возвращаем ключ пользователю
    return NextResponse.json({ key: keyData.key });

  } catch (error) {
    console.error('Claimkey API error:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' }, 
      { status: 500 }
    );
  }
}
